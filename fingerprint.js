// fingerprint.js — derives a stable identifier for an audio file so that
// re-picking the same file in a later session (see README: iOS doesn't
// reliably persist large audio blobs) can be matched back to its saved
// library entry and timestamps, without reading/hashing the whole file.
//
// This is a heuristic, not a cryptographic hash: filename + file size +
// duration. Good enough to distinguish "Concert Rehearsal.wav" from
// "Tuba Warmup.mp3" reliably, cheap to compute, and fast even for large
// WAV files. Trade-off (accepted per project plan): renaming a file, or
// re-exporting it with a different size/duration, will register as a
// "new" file rather than reconnecting — a fresh library entry with no
// timestamps, rather than data loss or a wrong match.

/**
 * @param {{ filename: string, fileSize: number, duration: number }} info
 * @returns {string}
 */
export function computeFingerprint({ filename, fileSize, duration }) {
  const normalizedName = filename.trim().toLowerCase();
  // Round duration to 0.1s: browsers can report metadata duration with tiny
  // floating-point jitter (e.g. 125.400001 vs 125.399998) between runs.
  const roundedDuration = Math.round(duration * 10) / 10;
  return `${normalizedName}::${fileSize}::${roundedDuration}`;
}
