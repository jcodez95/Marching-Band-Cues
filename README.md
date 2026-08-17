# Cuesheet

A mobile-first PWA for playing back audio recordings and dropping timestamped
notes on them. Built with plain HTML/CSS/JS — no framework, no build step.
**The shipped app has zero runtime dependencies** — see "Running the tests"
below for the one dev-only exception.

## Status: Sharing — the app itself, and completed cue sheets

- Step 1: installable app shell (manifest, service worker, icons, view routing).
- Step 2: `js/db.js` — IndexedDB CRUD for the library and timestamps stores.
- Step 3: file loading, fingerprinting, and basic playback (play/pause).
- Step 4: `js/timeline.js` — a custom, draggable progress bar.
- Step 5: the full timestamp workflow — add, list, markers, edit, delete.
- Step 6: library reconnect flow — tap an entry, re-pick the same file,
  its timestamps come back automatically (via fingerprint matching).
- Step 7: variable-speed scrubbing (`js/scrub-rate.js`) and persistent
  audio storage (files reopen with no re-picking required).
- Step 8: timeline zoom, precise time entry, and metronome count-off with
  tempo detection.
- This step, two things:
  - **Sharing the app**: there's no separate "app store" step needed —
    since it's a PWA hosted at a URL, sharing the app *is* sharing that
    URL. Anyone who opens it in Safari and taps "Add to Home Screen" gets
    their own independent, fully-installed copy. See "Sharing the app
    itself" below.
  - **Sharing cue sheets** (`js/cuesheet-io.js`): a **Share** button in the
    player header exports the current file's timestamps as a small `.json`
    file — on iOS this opens the native share sheet (AirDrop, Messages,
    Mail, etc.) directly; elsewhere it downloads the file. On the
    recipient's device, an **Import Cue Sheet** button on the library
    screen reads that file back in. Critically, this does **not** include
    the audio itself (kept small, and the recipient likely already has the
    audio some other way) — instead it carries the same filename/size/
    duration fingerprint the app already uses to reconnect your own
    re-picked files, so once the recipient loads that same audio file, the
    imported timestamps attach to it automatically. See "How cue sheet
    sharing works" below for the exact mechanism and its limits.

This completes every feature from the original spec plus every requested
enhancement since. Remaining and explicitly deferred: timestamp ranges
(start/end instead of a single point).

## Sharing the app itself

However you deployed this (Netlify, GitHub Pages, etc.), that URL *is* the
distributable app — there's nothing extra to build or package:

1. Send the URL to whoever needs it (text, email, whatever).
2. They open it in **Safari** on their iPhone/iPad (must be Safari for
   "Add to Home Screen" to work) or any browser on Android/desktop.
3. They tap Share → Add to Home Screen, same as you did.

Each person's install is **completely independent** — their saved files
and timestamps live only in their own browser's local storage, with no
built-in sync between devices. That's exactly why the cue-sheet
export/import feature below exists: it's the mechanism for actually
moving your work from your device to theirs.

## How cue sheet sharing works

**What gets shared:** a small JSON file containing the timestamps (time,
title, comment, and count-off settings) plus the *original audio file's*
filename, size, and duration — not the audio itself.

**Why not include the audio:** audio files can be large (a WAV easily
exceeds what's comfortable to send via Messages/email), and the recipient
very likely already has the same audio file (you probably shared it with
them separately, e.g. as the source recording for a rehearsal). Keeping
the cue sheet audio-free keeps it small and fast to send.

**How the pieces reconnect:** this reuses the exact same fingerprinting
system (`fingerprint.js`) that already reconnects *your own* re-picked
files across sessions. On import, the app computes a fingerprint from the
cue sheet's embedded file info and creates a lightweight library entry for
it (metadata only, marked "Needs re-select" since there's no audio cached
yet). When the recipient then loads that same audio file — same filename,
same file size, same duration — the fingerprint matches exactly and the
imported timestamps show up automatically, the same way reopening one of
your own files works.

**Limits worth knowing:**
- The recipient's audio file needs to be the *exact* same file (same
  filename, same byte size, same duration) for this to auto-match — a
  re-exported or renamed copy of the "same" recording will register as a
  different file and won't connect automatically. This is the same
  tradeoff the reconnect feature already accepts (see `fingerprint.js`).
- Re-importing the same cue sheet twice won't duplicate every timestamp —
  entries that match an existing one closely (same time within 10ms, same
  title) are skipped — but this isn't a true merge/diff; legitimately
  edited versions of the "same" timestamp (e.g. you renamed it) will show
  up as an additional entry rather than replacing the original.
- This is genuinely one-way, manual sharing, not sync. If you edit your
  cue sheet later, you'll need to export and send it again for others to
  get the update.

## How tempo detection works

When you turn on count-off for a timestamp, the app:

1. Decodes the loaded audio file into raw PCM samples using the Web Audio
   API (`AudioContext.decodeAudioData`) — this happens once per file per
   session and is cached in memory, not run automatically on every file load.
2. Looks at a ~10-second window of audio starting at that timestamp.
3. Computes a short-window energy envelope and finds local peaks —
   click tracks have sharp, well-isolated transients, so a simple
   energy-peak-picker works well without needing a full beat-tracking
   algorithm (`js/onset-detect.js`).
4. Takes the *median* interval between consecutive detected clicks (median,
   not mean, so one missed or spurious detection doesn't skew the result)
   and converts that to BPM.

This is validated with **automated tests against synthetically generated
click tracks at 60–240 BPM** (`scripts/test-onset-detect.mjs`), detecting
within about half a BPM in all cases, and correctly returning "no
confident estimate" for silence or unstructured noise rather than
guessing. What that testing *can't* cover is a real recorded click
track — room noise, a live count-in voice before the clicks start, a
click sound that's softer or less percussive than the synthetic impulses
used in testing, etc. The manual BPM field exists specifically because
automatic detection on real-world audio can be wrong; treat the detected
number as a strong starting guess; correcting a wrong number takes one tap.

**A separate, subtler technical issue this feature runs into:** the actual
click track only starts playing *after* the 8-click count-off finishes,
which fires from a timer — not a direct tap. iOS Safari normally blocks
audio playback that isn't triggered synchronously by a real user gesture,
which would silently break this. The app works around it with a standard
technique (`AudioEngine.unlock()` in `js/audio-engine.js`): the moment you
tap a timestamp, it silently plays-then-immediately-pauses the audio
element within that same tap, which "authorizes" a later programmatic
`play()` call for the rest of the session. This is a widely used pattern
(the same trick libraries like Howler.js use), but it isn't part of any
web spec — it's real-world observed browser behavior that could differ
across iOS versions. **This needs to be verified on an actual iPhone**;
it's not something I can confirm from this environment.

## A note on audio persistence

Earlier in this project, the deliberate choice was to *not* store the
audio binary and always have the user re-pick the file each session,
because:

- Safari can evict a "regular" website's IndexedDB data after about a
  week of inactivity (Apple's Intelligent Tracking Prevention).
- Storing very large files (a 100MB+ WAV) risks hitting storage quota.

That tradeoff has now been revisited because the convenience of not
re-picking a file every session outweighs the risk, for this app's use
case. To reduce (not eliminate) the risk:

- The app requests `navigator.storage.persist()` on load, a best-effort
  signal to the browser that this data matters. Installed home-screen
  PWAs (as opposed to a regular Safari tab) are generally less aggressively
  evicted in the first place.
- Every save is wrapped in error handling. If it fails, the file's
  timestamps are still saved safely — only the audio binary itself is
  affected, and that file simply falls back to needing re-selection next
  time (clearly marked "Needs re-select" in the library list).
- **This still isn't a guarantee.** The user's timestamps (the important
  data) are always safe regardless of what happens to a cached audio
  file. Worth testing over a real multi-day gap on an actual iPhone to see
  how this behaves in practice — that's not something that can be verified
  from this environment.

## Running it locally

Service workers and `manifest.json` require the page to be served over
`http://localhost` or `https://` — they will **not** work opened directly
from disk (`file://`). Easiest option, no dependencies needed:

```bash
cd cuesheet
python3 -m http.server 8000
```

Then open `http://localhost:8000` in a browser.

## Testing on an iPhone/iPad

1. The device needs to reach the same server — either run the command above
   on a machine on your Wi-Fi network and visit `http://<your-computer's-IP>:8000`,
   or deploy the folder somewhere with HTTPS (GitHub Pages, Netlify, etc.) once
   you're ready to test more broadly.
2. Open the URL in **Safari** (must be Safari, not Chrome, for "Add to Home
   Screen" to install a standalone PWA on iOS).
3. Tap the **Share** icon → **Add to Home Screen**.
4. Launch it from the home screen icon — it should open full-screen, no
   Safari address bar, using the dark status bar style we set.

## File structure

```
cuesheet/
  index.html            # single page; toggles between Library and Player views
  manifest.json          # PWA install metadata
  service-worker.js      # offline caching for the app shell
  css/
    base.css             # design tokens, resets, shared primitives
    library.css           # Library screen styles
    timeline.css            # scrub bar, zoom controls, scrub-speed label styles
    timestamps.css           # add-timestamp button, list, edit sheet, count-off toggle
    player.css                # Player screen layout/transport styles
  js/
    app.js                # entry point: SW registration, storage persist request, wiring
    db.js                  # IndexedDB layer: files + audio blobs + timestamps CRUD
    fingerprint.js          # derives a stable id to reconnect re-picked or imported files
    audio-engine.js          # wraps the shared <audio> element: load/play/pause/seek/unlock
    timeline.js                # draggable scrub bar + zoom + timestamp markers
    scrub-rate.js                # pure helper: vertical drag distance -> scrub speed
    onset-detect.js                # pure DSP: click-track tempo estimation from PCM samples
    tempo-detect.js                 # browser wrapper: decodes audio, calls onset-detect.js
    metronome.js                     # schedules the 8-click count-off via Web Audio
    cuesheet-io.js                    # export/import format for sharing a file's timestamps (new)
    timestamp-list.js                  # renders the timestamp list rows
    timestamp-editor.js                 # bottom-sheet editor: time/title/comment/nudge/count-off/delete
    utils.js                             # shared formatting helpers (time, precise time, relative date)
    library-view.js                       # Library screen: file loading, blob caching, list, import
    player-view.js                         # Player screen: playback + timestamps + count-off + share
  icons/                   # generated PWA/iOS icons
  scripts/
    make_icons.py           # dev-only utility that generated the icons — not shipped/loaded by the app
    test-db.mjs              # dev-only test suite for db.js — not shipped/loaded by the app
    test-fingerprint.mjs      # dev-only test suite for fingerprint.js — not shipped/loaded by the app
    test-scrub-rate.mjs        # dev-only test suite for scrub-rate.js — not shipped/loaded by the app
    test-time-format.mjs        # dev-only test suite for utils.js's time helpers
    test-onset-detect.mjs        # dev-only test suite for onset-detect.js, using synthetic click tracks
    test-metronome.mjs            # dev-only test suite for metronome.js scheduling
    test-cuesheet-io.mjs           # dev-only test suite for cuesheet-io.js (new)
  package.json               # dev-only, exists solely to run `npm test` (see below)
```

## Running the tests

Seven automated test suites run under Node — `db.js`'s tests use
[`fake-indexeddb`](https://www.npmjs.com/package/fake-indexeddb) (a
spec-accurate IndexedDB implementation for Node, including real Blob
storage/retrieval); this is the **one** dev-only dependency in the
project, never loaded by the app itself. `onset-detect.js`'s tests
synthesize click-track audio at known BPMs and verify the detector
recovers them accurately. `cuesheet-io.js`'s tests include a full
export→import round-trip and confirm the resulting fingerprint exactly
matches what loading the real audio file would produce (the mechanism the
whole sharing feature depends on). (`audio-engine.js`, `timeline.js`'s
drag interaction, Web Audio decoding in `tempo-detect.js`, the Web Share
API, and the view modules depend on real browser APIs and are exercised
by hand in-browser instead; see "Testing on an iPhone/iPad" above.)

```bash
cd cuesheet
npm install   # pulls in fake-indexeddb for testing only
npm test
```

## Design notes

- Dark, analog-studio palette (near-black background, amber "cue mark"
  accent) with a monospace font reserved for time readouts — a nod to
  tape-counter displays. Tokens live at the top of `css/base.css`.
- System fonts only, by design: keeps the shell fully functional offline
  with no font-loading dependency.
