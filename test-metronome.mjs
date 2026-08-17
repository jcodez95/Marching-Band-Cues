// scripts/test-metronome.mjs — dev-only tests for metronome.js's
// scheduling logic, using a minimal fake AudioContext/OscillatorNode
// (real Web Audio isn't available in Node). Verifies the right number of
// clicks get scheduled at the right times, and that cancel() actually
// stops everything and suppresses onComplete.
// Run with: node scripts/test-metronome.mjs

import assert from "node:assert/strict";

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

// ---- Minimal fake Web Audio API ----

class FakeGainParam {
  constructor() {
    this.calls = [];
  }
  setValueAtTime(value, time) {
    this.calls.push({ type: "set", value, time });
  }
  exponentialRampToValueAtTime(value, time) {
    this.calls.push({ type: "ramp", value, time });
  }
}

class FakeOscillator {
  constructor(ctx) {
    this.ctx = ctx;
    this.type = null;
    this.frequency = { value: 0 };
    this.startTime = null;
    this.stopTime = null;
    this._endedCallback = null;
  }
  connect(node) {
    return node;
  }
  start(time) {
    this.startTime = time;
    this.ctx.createdOscillators.push(this);
  }
  stop(time) {
    this.stopTime = time ?? this.ctx.currentTime;
    // Simulate the 'ended' event firing asynchronously, like a real node.
    if (this._endedCallback) setTimeout(() => this._endedCallback(), 0);
  }
  addEventListener(event, cb) {
    if (event === "ended") this._endedCallback = cb;
  }
}

class FakeGain {
  constructor() {
    this.gain = new FakeGainParam();
  }
  connect(node) {
    return node;
  }
}

class FakeAudioContext {
  constructor() {
    this.state = "running";
    this.currentTime = 0;
    this.createdOscillators = [];
  }
  createOscillator() {
    return new FakeOscillator(this);
  }
  createGain() {
    return new FakeGain();
  }
  resume() {
    this.state = "running";
  }
}

global.window = { AudioContext: FakeAudioContext };

const { Metronome } = await import("../js/metronome.js");

console.log("metronome.js tests\n");

await check("schedules the requested number of clicks", async () => {
  const m = new Metronome();
  m.playCountOff({ bpm: 6000, count: 8 }); // fast bpm so the test doesn't need to wait long in the fallback timing checks below
  const ctx = m._ctx;
  assert.equal(ctx.createdOscillators.length, 8);
  m.cancel();
});

await check("spaces clicks by 60/bpm seconds apart", async () => {
  const m = new Metronome();
  m.playCountOff({ bpm: 120, count: 4 }); // 0.5s apart
  const times = m._ctx.createdOscillators.map((o) => o.startTime).sort((a, b) => a - b);
  for (let i = 1; i < times.length; i++) {
    const gap = times[i] - times[i - 1];
    assert.ok(Math.abs(gap - 0.5) < 0.001, `expected ~0.5s gap, got ${gap}`);
  }
  m.cancel();
});

await check("accents every 4th click (beat 1 of each group) with a higher pitch", () => {
  const m = new Metronome();
  m.playCountOff({ bpm: 120, count: 8, accentEvery: 4 });
  const oscs = m._ctx.createdOscillators;
  // Clicks 0 and 4 (0-indexed) should be accented (higher frequency).
  assert.ok(oscs[0].frequency.value > oscs[1].frequency.value);
  assert.ok(oscs[4].frequency.value > oscs[5].frequency.value);
  assert.equal(oscs[0].frequency.value, oscs[4].frequency.value);
  m.cancel();
});

await check("calls onComplete after the scheduled duration elapses", async () => {
  const m = new Metronome();
  let completed = false;
  // Very fast tempo so the real setTimeout in the implementation resolves quickly.
  m.playCountOff({ bpm: 12000, count: 4, onComplete: () => (completed = true) });
  assert.equal(completed, false, "should not complete immediately");
  await new Promise((resolve) => setTimeout(resolve, 100));
  assert.equal(completed, true, "should have completed by now");
});

await check("cancel() stops all oscillators and suppresses onComplete", async () => {
  const m = new Metronome();
  let completed = false;
  m.playCountOff({ bpm: 12000, count: 4, onComplete: () => (completed = true) });
  m.cancel();
  await new Promise((resolve) => setTimeout(resolve, 100));
  assert.equal(completed, false, "onComplete should never fire after cancel()");
  assert.equal(m.isCountingOff, false);
});

await check("isCountingOff reflects state correctly", async () => {
  const m = new Metronome();
  assert.equal(m.isCountingOff, false);
  let completed = false;
  m.playCountOff({ bpm: 12000, count: 2, onComplete: () => (completed = true) });
  assert.equal(m.isCountingOff, true);
  await new Promise((resolve) => setTimeout(resolve, 100));
  assert.equal(completed, true);
  assert.equal(m.isCountingOff, false);
});

await check("invalid bpm calls onComplete immediately without throwing", () => {
  const m = new Metronome();
  let completed = false;
  m.playCountOff({ bpm: 0, onComplete: () => (completed = true) });
  assert.equal(completed, true);
});

console.log(`\n${passed} test(s) passed.`);
