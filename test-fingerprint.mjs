// scripts/test-fingerprint.mjs — dev-only sanity checks for fingerprint.js.
// Run with: node scripts/test-fingerprint.mjs

import assert from "node:assert/strict";
import { computeFingerprint } from "../js/fingerprint.js";

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

console.log("fingerprint.js tests\n");

check("same file info produces the same fingerprint", () => {
  const a = computeFingerprint({ filename: "Concert Rehearsal.wav", fileSize: 104857600 });
  const b = computeFingerprint({ filename: "Concert Rehearsal.wav", fileSize: 104857600 });
  assert.equal(a, b);
});

check("is case-insensitive and trims whitespace on filename", () => {
  const a = computeFingerprint({ filename: "Concert Rehearsal.wav", fileSize: 104857600 });
  const b = computeFingerprint({ filename: "  CONCERT REHEARSAL.WAV  ", fileSize: 104857600 });
  assert.equal(a, b);
});

check("different filenames produce different fingerprints", () => {
  const a = computeFingerprint({ filename: "Concert Rehearsal.wav", fileSize: 104857600 });
  const b = computeFingerprint({ filename: "Concert Rehearsal 2.wav", fileSize: 104857600 });
  assert.notEqual(a, b);
});

check("different file sizes produce different fingerprints", () => {
  const a = computeFingerprint({ filename: "Tuba Warmup.mp3", fileSize: 3145728 });
  const b = computeFingerprint({ filename: "Tuba Warmup.mp3", fileSize: 3145729 });
  assert.notEqual(a, b);
});

check(
  "REGRESSION: matches regardless of duration, even if a 'duration' field is present in the input " +
    "(the bug this file's design is protecting against — a cross-device duration decoding discrepancy " +
    "was breaking cue sheet import reconnection on iOS; duration is intentionally not part of the fingerprint)",
  () => {
    const exportedOnDeviceA = computeFingerprint({
      filename: "Warmup.mp3",
      fileSize: 3145728,
      duration: 125.35, // as measured by one browser/decoder
    });
    const loadedFreshOnDeviceB = computeFingerprint({
      filename: "Warmup.mp3",
      fileSize: 3145728,
      duration: 125.71, // same physical file, different decoder's duration estimate
    });
    assert.equal(exportedOnDeviceA, loadedFreshOnDeviceB);
  }
);

check("ignores any extra fields beyond filename/fileSize without erroring", () => {
  const a = computeFingerprint({ filename: "a.wav", fileSize: 1 });
  const b = computeFingerprint({ filename: "a.wav", fileSize: 1, duration: 999, somethingElse: "whatever" });
  assert.equal(a, b);
});

console.log(`\n${passed} test(s) passed.`);
