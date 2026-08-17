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
  const a = computeFingerprint({ filename: "Concert Rehearsal.wav", fileSize: 104857600, duration: 125.4 });
  const b = computeFingerprint({ filename: "Concert Rehearsal.wav", fileSize: 104857600, duration: 125.4 });
  assert.equal(a, b);
});

check("is case-insensitive and trims whitespace on filename", () => {
  const a = computeFingerprint({ filename: "Concert Rehearsal.wav", fileSize: 104857600, duration: 125.4 });
  const b = computeFingerprint({ filename: "  CONCERT REHEARSAL.WAV  ", fileSize: 104857600, duration: 125.4 });
  assert.equal(a, b);
});

check("absorbs tiny floating-point jitter in duration (< 0.05s)", () => {
  const a = computeFingerprint({ filename: "Tuba Warmup.mp3", fileSize: 3145728, duration: 42.00001 });
  const b = computeFingerprint({ filename: "Tuba Warmup.mp3", fileSize: 3145728, duration: 41.99998 });
  assert.equal(a, b);
});

check("different filenames produce different fingerprints", () => {
  const a = computeFingerprint({ filename: "Concert Rehearsal.wav", fileSize: 104857600, duration: 125.4 });
  const b = computeFingerprint({ filename: "Concert Rehearsal 2.wav", fileSize: 104857600, duration: 125.4 });
  assert.notEqual(a, b);
});

check("different durations produce different fingerprints", () => {
  const a = computeFingerprint({ filename: "Tuba Warmup.mp3", fileSize: 3145728, duration: 42.0 });
  const b = computeFingerprint({ filename: "Tuba Warmup.mp3", fileSize: 3145728, duration: 58.0 });
  assert.notEqual(a, b);
});

console.log(`\n${passed} test(s) passed.`);
