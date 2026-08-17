// scripts/test-cuesheet-io.mjs — dev-only tests for cuesheet-io.js.
// Run with: node scripts/test-cuesheet-io.mjs

import assert from "node:assert/strict";
import { buildCuesheetExport, parseCuesheetImport, suggestExportFilename } from "../js/cuesheet-io.js";

let passed = 0;
function check(label, fn) {
  try {
    fn();
    passed++;
    console.log(`  ok  - ${label}`);
  } catch (err) {
    console.error(`FAIL - ${label}`);
    console.error(err);
    process.exitCode = 1;
  }
}

console.log("cuesheet-io.js tests\n");

check("round-trips a full export/import cycle", () => {
  const fileInfo = { filename: "Concert Rehearsal.wav", fileSize: 104857600, duration: 125.4 };
  const timestamps = [
    { id: "a", fingerprintId: "x", time: 42, title: "Trumpets enter", comment: "", createdAt: 1, countOffEnabled: false, countOffBpm: null },
    { id: "b", fingerprintId: "x", time: 77, title: "Balance issue", comment: "Brass too loud", createdAt: 2, countOffEnabled: true, countOffBpm: 96 },
  ];

  const exported = buildCuesheetExport(fileInfo, timestamps);
  const json = JSON.stringify(exported);
  const parsed = parseCuesheetImport(json);

  assert.equal(parsed.file.filename, "Concert Rehearsal.wav");
  assert.equal(parsed.file.fileSize, 104857600);
  assert.equal(parsed.file.duration, 125.4);
  assert.equal(parsed.timestamps.length, 2);
  assert.equal(parsed.timestamps[0].title, "Trumpets enter");
  assert.equal(parsed.timestamps[1].countOffEnabled, true);
  assert.equal(parsed.timestamps[1].countOffBpm, 96);
});

check("export omits the id/fingerprintId/createdAt fields (not portable across devices)", () => {
  const fileInfo = { filename: "a.wav", fileSize: 1, duration: 1 };
  const timestamps = [{ id: "local-id-123", fingerprintId: "local-fp", time: 5, title: "X", comment: "", createdAt: 999 }];
  const exported = buildCuesheetExport(fileInfo, timestamps);
  assert.equal(exported.timestamps[0].id, undefined);
  assert.equal(exported.timestamps[0].fingerprintId, undefined);
  assert.equal(exported.timestamps[0].createdAt, undefined);
});

check("rejects invalid JSON", () => {
  assert.throws(() => parseCuesheetImport("not json"), /valid JSON/);
});

check("rejects JSON missing required structure", () => {
  assert.throws(() => parseCuesheetImport(JSON.stringify({ foo: "bar" })));
});

check("rejects a mismatched format version", () => {
  const badVersion = JSON.stringify({
    cuesheetFormat: 999,
    file: { filename: "a.wav", fileSize: 1, duration: 1 },
    timestamps: [],
  });
  assert.throws(() => parseCuesheetImport(badVersion), /different app version/);
});

check("rejects a file section missing required fields", () => {
  const badFile = JSON.stringify({ cuesheetFormat: 1, file: { filename: "a.wav" }, timestamps: [] });
  assert.throws(() => parseCuesheetImport(badFile), /missing information/);
});

check("filters out malformed timestamp entries rather than throwing", () => {
  const parsed = parseCuesheetImport(
    JSON.stringify({
      cuesheetFormat: 1,
      file: { filename: "a.wav", fileSize: 1, duration: 1 },
      timestamps: [{ time: 5, title: "Good" }, { time: -1, title: "Bad, negative time" }, "garbage", null, 42],
    })
  );
  assert.equal(parsed.timestamps.length, 1);
  assert.equal(parsed.timestamps[0].title, "Good");
});

check("fills in sensible defaults for a minimal timestamp entry", () => {
  const parsed = parseCuesheetImport(
    JSON.stringify({
      cuesheetFormat: 1,
      file: { filename: "a.wav", fileSize: 1, duration: 1 },
      timestamps: [{ time: 10 }], // no title/comment/countOff fields at all
    })
  );
  assert.equal(parsed.timestamps[0].title, "Untitled");
  assert.equal(parsed.timestamps[0].comment, "");
  assert.equal(parsed.timestamps[0].countOffEnabled, false);
  assert.equal(parsed.timestamps[0].countOffBpm, null);
});

check("suggestExportFilename strips the audio extension and adds .cuesheet.json", () => {
  assert.equal(suggestExportFilename("Concert Rehearsal.wav"), "Concert Rehearsal.cuesheet.json");
  assert.equal(suggestExportFilename("warmup.mp3"), "warmup.cuesheet.json");
  assert.equal(suggestExportFilename("no-extension"), "no-extension.cuesheet.json");
});

console.log(`\n${passed} test(s) passed.`);
