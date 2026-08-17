// scripts/test-onset-detect.mjs — validates the tempo-detection algorithm
// against SYNTHETIC click-track audio at known BPMs, so we have genuine
// confidence the math works rather than just trusting it by inspection.
// Run with: node scripts/test-onset-detect.mjs

import assert from "node:assert/strict";
import { detectOnsets, estimateTempo } from "../js/onset-detect.js";

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

/**
 * Synthesizes a mono click track: sharp decaying impulses at a fixed BPM,
 * against a near-silent (small-amplitude noise) background — approximating
 * a real recorded click track closely enough to validate the detector's
 * core logic (energy-envelope peak picking + median interval estimation).
 */
function makeClickTrack({ bpm, sampleRate, seconds, clickLengthSamples = 30, noiseFloor = 0.001 }) {
  const totalSamples = Math.floor(seconds * sampleRate);
  const samples = new Float32Array(totalSamples);

  // Quiet background noise, so the envelope isn't literally all zero
  // between clicks (more realistic than pure digital silence).
  for (let i = 0; i < totalSamples; i++) {
    samples[i] = (Math.random() * 2 - 1) * noiseFloor;
  }

  const intervalSamples = (60 / bpm) * sampleRate;
  for (let t = 0; t < totalSamples; t += intervalSamples) {
    const start = Math.round(t);
    for (let i = 0; i < clickLengthSamples && start + i < totalSamples; i++) {
      const decay = Math.exp(-i / 5);
      samples[start + i] += decay * (i % 2 === 0 ? 1 : -1);
    }
  }
  return samples;
}

console.log("onset-detect.js tests\n");

check("detects a click track's tempo within 1 BPM at a moderate tempo", () => {
  const sampleRate = 44100;
  const samples = makeClickTrack({ bpm: 96, sampleRate, seconds: 10 });
  const result = estimateTempo(samples, sampleRate, 0, samples.length);
  assert.ok(result, "expected a tempo estimate");
  assert.ok(Math.abs(result.bpm - 96) < 1, `expected ~96 BPM, got ${result.bpm}`);
});

check("detects tempo correctly across a range of realistic click-track BPMs", () => {
  const sampleRate = 44100;
  for (const bpm of [60, 80, 120, 144, 180]) {
    const samples = makeClickTrack({ bpm, sampleRate, seconds: 8 });
    const result = estimateTempo(samples, sampleRate, 0, samples.length);
    assert.ok(result, `expected a tempo estimate at ${bpm} BPM`);
    assert.ok(Math.abs(result.bpm - bpm) < 1.5, `expected ~${bpm} BPM, got ${result.bpm}`);
  }
});

check("detectOnsets finds roughly the expected number of clicks", () => {
  const sampleRate = 44100;
  const samples = makeClickTrack({ bpm: 96, sampleRate, seconds: 10 });
  const onsets = detectOnsets(samples, sampleRate, 0, samples.length);
  // 96 bpm over 10s = 16 clicks expected; allow a little slack.
  assert.ok(onsets.length >= 14 && onsets.length <= 18, `expected ~16 onsets, got ${onsets.length}`);
});

check("returns null when there isn't enough audio to find enough onsets", () => {
  const sampleRate = 44100;
  // Only ~1.5 seconds — not enough clicks at a normal tempo to be confident.
  const samples = makeClickTrack({ bpm: 90, sampleRate, seconds: 1.5 });
  const result = estimateTempo(samples, sampleRate, 0, samples.length);
  assert.equal(result, null);
});

check("returns null (not a wild guess) for pure silence", () => {
  const sampleRate = 44100;
  const samples = new Float32Array(sampleRate * 5); // all zeros
  const result = estimateTempo(samples, sampleRate, 0, samples.length);
  assert.equal(result, null);
});

check("returns null for uniform low-level noise with no distinct clicks", () => {
  const sampleRate = 44100;
  const samples = new Float32Array(sampleRate * 5);
  for (let i = 0; i < samples.length; i++) {
    samples[i] = (Math.random() * 2 - 1) * 0.05; // constant-amplitude noise, no transients
  }
  const result = estimateTempo(samples, sampleRate, 0, samples.length);
  // With no sharp peaks standing out above threshold relative to the
  // (fairly uniform) noise floor, this should not produce a confident result.
  assert.equal(result, null);
});

check("respects the startSample/endSample window — only analyzes the given region", () => {
  const sampleRate = 44100;
  // 90 BPM for the first half, silence for the second half.
  const clickPart = makeClickTrack({ bpm: 90, sampleRate, seconds: 8 });
  const silence = new Float32Array(sampleRate * 8);
  const combined = new Float32Array(clickPart.length + silence.length);
  combined.set(clickPart, 0);
  combined.set(silence, clickPart.length);

  // Analyzing just the click region should succeed...
  const resultInWindow = estimateTempo(combined, sampleRate, 0, clickPart.length);
  assert.ok(resultInWindow);
  assert.ok(Math.abs(resultInWindow.bpm - 90) < 1);

  // ...while analyzing just the silent region should not.
  const resultOutOfWindow = estimateTempo(combined, sampleRate, clickPart.length, combined.length);
  assert.equal(resultOutOfWindow, null);
});

console.log(`\n${passed} test(s) passed.`);
