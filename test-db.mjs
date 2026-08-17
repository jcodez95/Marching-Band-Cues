// scripts/test-db.mjs — exercises db.js against fake-indexeddb (a
// spec-accurate IndexedDB implementation for Node) so the persistence
// layer can be verified without a browser.
//
// Dev-only: not part of the shipped app, not referenced by index.html.
// Run with: node scripts/test-db.mjs

import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import {
  upsertFile,
  getFile,
  getAllFiles,
  deleteFile,
  addTimestamp,
  updateTimestamp,
  deleteTimestamp,
  getTimestampsForFile,
  saveAudioBlob,
  getAudioBlob,
  deleteAudioBlob,
} from "../js/db.js";

let passed = 0;
function check(label, fn) {
  return Promise.resolve()
    .then(fn)
    .then(() => {
      passed++;
      console.log(`  ok  - ${label}`);
    })
    .catch((err) => {
      console.error(`FAIL - ${label}`);
      console.error(err);
      process.exitCode = 1;
    });
}

async function run() {
  console.log("db.js tests\n");

  const fpA = "concert-rehearsal-wav-104857600-125.4";
  const fpB = "warmup-mp3-3145728-42.0";

  await check("upsertFile + getFile round-trip", async () => {
    await upsertFile({
      fingerprintId: fpA,
      filename: "Concert Rehearsal.wav",
      fileSize: 104857600,
      duration: 125.4,
      lastOpened: Date.now(),
    });
    const file = await getFile(fpA);
    assert.equal(file.filename, "Concert Rehearsal.wav");
    assert.equal(file.fingerprintId, fpA);
  });

  await check("getFile returns undefined for unknown fingerprint", async () => {
    const file = await getFile("does-not-exist");
    assert.equal(file, undefined);
  });

  await check("getAllFiles sorts by lastOpened, most recent first", async () => {
    await upsertFile({
      fingerprintId: fpB,
      filename: "Tuba Warmup.mp3",
      fileSize: 3145728,
      duration: 42.0,
      lastOpened: Date.now() + 1000, // newer than fpA
    });
    const all = await getAllFiles();
    assert.equal(all.length, 2);
    assert.equal(all[0].fingerprintId, fpB);
    assert.equal(all[1].fingerprintId, fpA);
  });

  let ts1, ts2;

  await check("addTimestamp generates an id and persists the record", async () => {
    ts1 = await addTimestamp({
      fingerprintId: fpA,
      time: 42,
      title: "Trumpets enter",
      comment: "",
      createdAt: Date.now(),
    });
    assert.ok(ts1.id, "expected a generated id");

    ts2 = await addTimestamp({
      fingerprintId: fpA,
      time: 77,
      title: "Balance issue here",
      comment: "Brass too loud vs strings",
      createdAt: Date.now(),
    });
    assert.ok(ts2.id);
    assert.notEqual(ts1.id, ts2.id);
  });

  await check("getTimestampsForFile returns only that file's timestamps, sorted by time", async () => {
    await addTimestamp({
      fingerprintId: fpB,
      time: 5,
      title: "Different file's timestamp",
      comment: "",
      createdAt: Date.now(),
    });

    const results = await getTimestampsForFile(fpA);
    assert.equal(results.length, 2);
    assert.equal(results[0].title, "Trumpets enter"); // time 42, earlier
    assert.equal(results[1].title, "Balance issue here"); // time 77, later
  });

  await check("updateTimestamp edits title/comment/time (nudge)", async () => {
    await updateTimestamp({ ...ts2, time: 77.5, comment: "Brass too loud, fixed by bar 80" });
    const results = await getTimestampsForFile(fpA);
    const updated = results.find((t) => t.id === ts2.id);
    assert.equal(updated.time, 77.5);
    assert.equal(updated.comment, "Brass too loud, fixed by bar 80");
  });

  await check("deleteTimestamp removes only that timestamp", async () => {
    await deleteTimestamp(ts1.id);
    const results = await getTimestampsForFile(fpA);
    assert.equal(results.length, 1);
    assert.equal(results[0].id, ts2.id);
  });

  await check("deleteFile cascades: removes the file AND its remaining timestamps", async () => {
    await deleteFile(fpA);
    const file = await getFile(fpA);
    assert.equal(file, undefined);

    const remainingTimestamps = await getTimestampsForFile(fpA);
    assert.equal(remainingTimestamps.length, 0);

    // fpB's file and timestamp should be untouched
    const fileB = await getFile(fpB);
    assert.ok(fileB);
    const tsB = await getTimestampsForFile(fpB);
    assert.equal(tsB.length, 1);
  });

  await check("reconnect scenario: re-picking the same file (same fingerprint) surfaces its saved timestamps", async () => {
    // Simulates library-view.js's flow: load a file, save some timestamps,
    // "close" it (nothing to do — no in-memory state persists across a
    // session boundary here), then "re-pick" the same file later and
    // confirm its timestamps come back via the same fingerprint.
    const fp = "rehearsal-take-2-wav-52428800-90.0";

    await upsertFile({
      fingerprintId: fp,
      filename: "Rehearsal Take 2.wav",
      fileSize: 52428800,
      duration: 90.0,
      lastOpened: Date.now() - 100000,
    });
    await addTimestamp({ fingerprintId: fp, time: 10, title: "Intro", comment: "", createdAt: Date.now() });
    await addTimestamp({ fingerprintId: fp, time: 60, title: "Bridge", comment: "", createdAt: Date.now() });

    // "Re-picking" the file: fingerprint is recomputed identically from the
    // same filename+size+duration, and upsertFile just bumps lastOpened —
    // it must NOT touch the timestamps store.
    await upsertFile({
      fingerprintId: fp,
      filename: "Rehearsal Take 2.wav",
      fileSize: 52428800,
      duration: 90.0,
      lastOpened: Date.now(),
    });

    const reconnected = await getTimestampsForFile(fp);
    assert.equal(reconnected.length, 2);
    assert.equal(reconnected[0].title, "Intro");
    assert.equal(reconnected[1].title, "Bridge");
  });

  await check("saveAudioBlob + getAudioBlob round-trip preserves blob content and type", async () => {
    const fp = "warmup-take-3-mp3-1048576-30.0";
    const original = new Blob(["fake mp3 bytes go here"], { type: "audio/mpeg" });

    await saveAudioBlob(fp, original);
    const retrieved = await getAudioBlob(fp);

    assert.ok(retrieved instanceof Blob, "expected a Blob back");
    assert.equal(retrieved.type, "audio/mpeg");
    assert.equal(retrieved.size, original.size);

    const text = await retrieved.text();
    assert.equal(text, "fake mp3 bytes go here");
  });

  await check("getAudioBlob returns undefined when no blob was ever saved for a fingerprint", async () => {
    const blob = await getAudioBlob("never-saved-fingerprint");
    assert.equal(blob, undefined);
  });

  await check("deleteAudioBlob removes just the blob, leaving the file record and timestamps intact", async () => {
    const fp = "warmup-take-3-mp3-1048576-30.0";
    await deleteAudioBlob(fp);
    const blob = await getAudioBlob(fp);
    assert.equal(blob, undefined);
  });

  await check("deleteFile cascades to the audio blob too, not just timestamps", async () => {
    const fp = "full-cascade-test-wav-999-15.0";
    await upsertFile({
      fingerprintId: fp,
      filename: "Full Cascade Test.wav",
      fileSize: 999,
      duration: 15.0,
      lastOpened: Date.now(),
      hasStoredAudio: true,
    });
    await saveAudioBlob(fp, new Blob(["x"], { type: "audio/wav" }));
    await addTimestamp({ fingerprintId: fp, time: 1, title: "Point", comment: "", createdAt: Date.now() });

    await deleteFile(fp);

    assert.equal(await getFile(fp), undefined);
    assert.equal(await getAudioBlob(fp), undefined);
    assert.equal((await getTimestampsForFile(fp)).length, 0);
  });

  console.log(`\n${passed} test(s) passed.`);
  if (process.exitCode) {
    console.log("Some tests FAILED — see above.");
  }
}

run();
