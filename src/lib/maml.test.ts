import { describe, it, expect } from 'vitest';
import { blendAny } from './maml.js';

describe('maml blendAny', () => {
  it('should blend scalar numbers correctly with a given beta', () => {
    const meta = 10;
    const local = 20;
    const beta = 0.1;
    // Expected: 10 * 0.9 + 20 * 0.1 = 9 + 2 = 11
    expect(blendAny(meta, local, beta)).toBeCloseTo(11, 5);
  });

  it('should handle infinite or NaN scalar values gracefully', () => {
    expect(blendAny(NaN, 5.0, 0.5)).toBe(5.0);
    expect(blendAny(10.0, Infinity, 0.5)).toBe(10.0);
  });

  it('should blend arrays of numbers recursively', () => {
    const meta = [1.0, 2.0, 3.0];
    const local = [2.0, 4.0, 6.0];
    const beta = 0.5;
    // Expected: [1.5, 3.0, 4.5]
    const blended = blendAny(meta, local, beta);
    expect(blended[0]).toBeCloseTo(1.5, 5);
    expect(blended[1]).toBeCloseTo(3.0, 5);
    expect(blended[2]).toBeCloseTo(4.5, 5);
  });

  it('should blend complex nested objects correctly', () => {
    const meta = {
      learningRate: 0.01,
      weights: {
        layer1: [0.5, 0.8],
        layer2: 1.5
      }
    };
    const local = {
      learningRate: 0.02,
      weights: {
        layer1: [0.7, 1.2],
        layer2: 2.5
      }
    };
    const beta = 0.2;
    const blended = blendAny(meta, local, beta);

    // Expected learningRate: 0.01 * 0.8 + 0.02 * 0.2 = 0.008 + 0.004 = 0.012
    expect(blended.learningRate).toBeCloseTo(0.012, 5);
    // Expected weights.layer2: 1.5 * 0.8 + 2.5 * 0.2 = 1.2 + 0.5 = 1.7
    expect(blended.weights.layer2).toBeCloseTo(1.7, 5);
    // Expected weights.layer1[0]: 0.5 * 0.8 + 0.7 * 0.2 = 0.4 + 0.14 = 0.54
    expect(blended.weights.layer1[0]).toBeCloseTo(0.54, 5);
  });

  it('should parse and blend JSON serialized weight strings recursively', () => {
    const metaJson = JSON.stringify([[1.0, 2.0], [3.0, 4.0]]);
    const localJson = JSON.stringify([[2.0, 3.0], [4.0, 5.0]]);
    const beta = 0.5;
    const blendedJson = blendAny(metaJson, localJson, beta);
    const blended = JSON.parse(blendedJson);

    expect(blended[0][0]).toBeCloseTo(1.5, 5);
    expect(blended[0][1]).toBeCloseTo(2.5, 5);
    expect(blended[1][0]).toBeCloseTo(3.5, 5);
    expect(blended[1][1]).toBeCloseTo(4.5, 5);
  });
});
