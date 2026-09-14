/**
 * Snake-hiss sound effect — the synthesis maths.
 *
 * ADAPTED COPY — see docs/SYNC.md. Upstream's src/lib/hiss.ts additionally holds
 * `playSnakeHiss`, which drives the Web Audio API through ./audioContext. That
 * playback half is platform code: it becomes an expo-audio player behind the
 * audio adapter in WP-6.2. The noise fill and the amplitude envelope below are
 * plain maths, are what upstream's tests cover, and are shared unchanged.
 *
 * On a drift alert for this file: if the upstream change is inside
 * `playSnakeHiss`, it belongs in the platform adapter, not here.
 */

/** Length of one hiss, in seconds. */
export const HISS_DURATION_S = 0.85;

/** Peak gain of the hiss — loud enough to be playful, quiet enough for a phone. */
export const HISS_PEAK_GAIN = 0.32;

/** Number of points in the amplitude envelope handed to the gain node. */
const ENVELOPE_POINTS = 128;

/** Fraction of the hiss spent ramping up, and the point the tail starts. */
const ATTACK_FRACTION = 0.08;
const RELEASE_START = 0.55;

/** Breath waver: how many times the hiss pulses, and how deep each dip goes. */
const FLUTTER_CYCLES = 7;
const FLUTTER_DEPTH = 0.15;

/**
 * Fills `data` with white noise in [-1, 1). `random` is injectable so the shape
 * of the buffer can be asserted in tests.
 */
export function fillWithNoise(data: Float32Array, random: () => number = Math.random): void {
  for (let i = 0; i < data.length; i += 1) {
    data[i] = random() * 2 - 1;
  }
}

/**
 * Amplitude envelope for the hiss: a fast attack, a fluttering body (so it
 * breathes like a real snake instead of sounding like radio static) and a long
 * fade to silence. Returned as a value curve normalised over the full duration.
 */
export function hissEnvelope(points = ENVELOPE_POINTS, peak = HISS_PEAK_GAIN): Float32Array {
  const curve = new Float32Array(points);

  for (let i = 0; i < points; i += 1) {
    const t = i / (points - 1);
    const attack = Math.min(t / ATTACK_FRACTION, 1);
    const release = t < RELEASE_START ? 1 : Math.max(0, 1 - (t - RELEASE_START) / (1 - RELEASE_START));
    const flutter = 1 - FLUTTER_DEPTH + FLUTTER_DEPTH * Math.sin(t * Math.PI * 2 * FLUTTER_CYCLES);
    curve[i] = peak * attack * release * flutter;
  }

  // Guarantee true silence at both ends so the tap never clicks.
  curve[0] = 0;
  curve[points - 1] = 0;
  return curve;
}
