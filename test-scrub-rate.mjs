// scripts/test-scrub-rate.mjs — dev-only sanity checks for scrub-rate.js.
// Run with: node scripts/test-scrub-rate.mjs

import assert from "node:assert/strict";
import { scrubRateForOffset } from "../js/scrub-rate.js";

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

console.log("scrub-rate.js tests\n");

check("near the track (dy=0) is full speed with no label", () => {
  const { rate, label } = scrubRateForOffset(0);
  assert.equal(rate, 1);
  assert.equal(label, null);
});

check("small vertical offset stays at full speed", () => {
  const { rate } = scrubRateForOffset(39);
  assert.equal(rate, 1);
});

check("rate strictly decreases as offset grows", () => {
  const r1 = scrubRateForOffset(20).rate;
  const r2 = scrubRateForOffset(60).rate;
  const r3 = scrubRateForOffset(110).rate;
  const r4 = scrubRateForOffset(500).rate;
  assert.ok(r1 > r2, "expected rate to drop entering zone 2");
  assert.ok(r2 > r3, "expected rate to drop entering zone 3");
  assert.ok(r3 > r4, "expected rate to drop entering zone 4");
});

check("every non-full-speed zone has a label", () => {
  assert.ok(scrubRateForOffset(60).label);
  assert.ok(scrubRateForOffset(110).label);
  assert.ok(scrubRateForOffset(500).label);
});

check("negative offsets (dragging below the track) behave the same as positive", () => {
  assert.deepEqual(scrubRateForOffset(-60), scrubRateForOffset(60));
});

check("very large offsets don't throw and stay at the slowest rate", () => {
  const a = scrubRateForOffset(1000).rate;
  const b = scrubRateForOffset(100000).rate;
  assert.equal(a, b);
});

console.log(`\n${passed} test(s) passed.`);
