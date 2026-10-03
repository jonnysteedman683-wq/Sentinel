import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { sphericalKMeans } from '../clustering.js';

describe('sphericalKMeans', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return empty array for empty input', () => {
    expect(sphericalKMeans([], 2)).toEqual([]);
  });

  it('should correctly cluster distinct orthogonal groups', () => {
    // Mock Math.random to ensure deterministic initial centroids
    let randomCount = 0;
    vi.spyOn(Math, 'random').mockImplementation(() => {
      const vals = [0.0, 0.6];
      return vals[randomCount++ % vals.length];
    });

    const vectors = [
      [1, 0, 0],
      [0.9, 0.1, 0], // close to first
      [0.8, 0, 0.1], // close to first
      [0, 1, 0],
      [0, 0.9, 0.1], // close to second
      [0.1, 0.8, 0], // close to second
    ];

    const assignments = sphericalKMeans(vectors, 2, 10);

    expect(assignments.length).toBe(6);
    expect(assignments[0]).toBe(assignments[1]);
    expect(assignments[1]).toBe(assignments[2]);
    expect(assignments[3]).toBe(assignments[4]);
    expect(assignments[4]).toBe(assignments[5]);
    expect(assignments[0]).not.toBe(assignments[3]);
  });

  it('should handle zero vectors gracefully', () => {
    const vectors = [
      [0, 0],
      [0, 0],
      [1, 1]
    ];
    let randomCount = 0;
    vi.spyOn(Math, 'random').mockImplementation(() => {
      const vals = [0.1, 0.8];
      return vals[randomCount++ % vals.length];
    });
    const assignments = sphericalKMeans(vectors, 2);
    expect(assignments.length).toBe(3);
    expect(assignments.every(a => !Number.isNaN(a))).toBe(true);
  });

  it('should handle k greater than or equal to number of vectors', () => {
    const vectors = [
      [1, 0],
      [0, 1]
    ];
    let randomCount = 0;
    vi.spyOn(Math, 'random').mockImplementation(() => {
      const vals = [0.1, 0.9];
      return vals[randomCount++ % vals.length];
    });
    // k = 3, n = 2
    const assignments = sphericalKMeans(vectors, 3);
    expect(assignments.length).toBe(2);
  });

  it('should handle empty clusters during iteration', () => {
    let randomCount = 0;
    vi.spyOn(Math, 'random').mockImplementation(() => {
      const vals = [0.1, 0.5, 0.9];
      return vals[randomCount++ % vals.length];
    });

    const vectors = [
      [1, 0],
      [1, 0],
      [1, 0]
    ];

    const assignments = sphericalKMeans(vectors, 3, 5);
    expect(assignments.length).toBe(3);
    expect(assignments.every(a => Number.isInteger(a) && a >= 0 && a < 3)).toBe(true);
  });
});
