import { describe, expect, it } from "vitest";

import { fillWithNoise, hissEnvelope, HISS_PEAK_GAIN } from "./hiss";

describe("fillWithNoise", () => {
  it("fills every sample within the audio range", () => {
    const data = new Float32Array(256);
    fillWithNoise(data);

    for (const sample of data) {
      expect(sample).toBeGreaterThanOrEqual(-1);
      expect(sample).toBeLessThan(1);
    }
  });

  it("maps the random source across the full bipolar range", () => {
    const values = [0, 0.5, 1];
    let i = 0;
    const data = new Float32Array(values.length);
    fillWithNoise(data, () => values[i++]);

    expect(Array.from(data)).toEqual([-1, 0, 1]);
  });
});

describe("hissEnvelope", () => {
  it("starts and ends at silence", () => {
    const curve = hissEnvelope();

    expect(curve[0]).toBe(0);
    expect(curve[curve.length - 1]).toBe(0);
  });

  it("never exceeds the peak gain", () => {
    const curve = hissEnvelope();

    for (const gain of curve) {
      expect(gain).toBeGreaterThanOrEqual(0);
      expect(gain).toBeLessThanOrEqual(HISS_PEAK_GAIN);
    }
  });

  it("reaches full volume in the body and fades out by the tail", () => {
    const curve = hissEnvelope(200);
    const at = (fraction: number) => curve[Math.round(fraction * (curve.length - 1))];

    // Past the attack the hiss is loud; the release ramps it back down.
    expect(at(0.3)).toBeGreaterThan(HISS_PEAK_GAIN * 0.5);
    expect(at(0.9)).toBeLessThan(at(0.5));
  });

  it("honours a custom peak", () => {
    const curve = hissEnvelope(64, 0.1);

    expect(Math.max(...curve)).toBeLessThanOrEqual(0.1);
  });
});
