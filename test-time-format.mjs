// scripts/test-time-format.mjs — dev-only sanity checks for the precise
// time formatting/parsing helpers in utils.js.
// Run with: node scripts/test-time-format.mjs

import assert from "node:assert/strict";
import { formatTimePrecise, parseTimeString } from "../js/utils.js";

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

console.log("time-format tests\n");

check("formatTimePrecise formats hundredths correctly", () => {
  assert.equal(formatTimePrecise(70.05), "1:10.05");
  assert.equal(formatTimePrecise(0), "0:00.00");
  assert.equal(formatTimePrecise(5), "0:05.00");
});

check("formatTimePrecise handles invalid input safely", () => {
  assert.equal(formatTimePrecise(-1), "0:00.00");
  assert.equal(formatTimePrecise(NaN), "0:00.00");
});

check("parseTimeString accepts bare seconds", () => {
  assert.equal(parseTimeString("70"), 70);
  assert.equal(parseTimeString("70.5"), 70.5);
});

check("parseTimeString accepts M:SS", () => {
  assert.equal(parseTimeString("1:10"), 70);
  assert.equal(parseTimeString("0:05"), 5);
});

check("parseTimeString accepts M:SS.ff (period before fraction)", () => {
  assert.equal(parseTimeString("1:10.05"), 70.05);
});

check("parseTimeString accepts M:SS:ff (colon before fraction, per the user's example)", () => {
  assert.equal(parseTimeString("1:10:05"), 70.05);
});

check("parseTimeString round-trips with formatTimePrecise", () => {
  const original = 125.42;
  const formatted = formatTimePrecise(original);
  const parsed = parseTimeString(formatted);
  assert.ok(Math.abs(parsed - original) < 0.01);
});

check("parseTimeString rejects invalid input", () => {
  assert.equal(parseTimeString("garbage"), null);
  assert.equal(parseTimeString(""), null);
  assert.equal(parseTimeString("1:99"), null); // seconds must be < 60
  assert.equal(parseTimeString("-5"), null);
  assert.equal(parseTimeString("1:2:3:4"), null); // too many segments (no hours support)
  assert.equal(parseTimeString(null), null);
  assert.equal(parseTimeString(undefined), null);
});

check("parseTimeString trims whitespace", () => {
  assert.equal(parseTimeString("  1:10  "), 70);
});

console.log(`\n${passed} test(s) passed.`);
