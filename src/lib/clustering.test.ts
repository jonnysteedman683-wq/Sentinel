import { describe, it, expect } from 'vitest';
import { sphericalKMeans } from './clustering.js';

const seededRandom = (() => {
  let seed = 12345;
  return () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
})();


describe('sphericalKMeans', () => {
  it('should correctly cluster distinct groups', () => {
    // 3 distinct groups in 3D space
    const vectors = [
      [1, 0, 0], [0.9, 0.1, 0], [0.8, 0, 0.1], // Group 1 ~ x-axis
      [0, 1, 0], [0.1, 0.9, 0], [0, 0.8, 0.1], // Group 2 ~ y-axis
      [0, 0, 1], [0.1, 0, 0.9], [0, 0.1, 0.8]  // Group 3 ~ z-axis
    ];

    const k = 3;
    const assignments = sphericalKMeans(vectors, k, 50, seededRandom);
    
    expect(assignments.length).toBe(vectors.length);

    // Points in the same group should have the same assignment
    expect(assignments[0]).toBe(assignments[1]);
    expect(assignments[0]).toBe(assignments[2]);
    
    expect(assignments[3]).toBe(assignments[4]);
    expect(assignments[3]).toBe(assignments[5]);

    expect(assignments[6]).toBe(assignments[7]);
    expect(assignments[6]).toBe(assignments[8]);

    // Points in different groups should have different assignments
    expect(assignments[0]).not.toBe(assignments[3]);
    expect(assignments[0]).not.toBe(assignments[6]);
    expect(assignments[3]).not.toBe(assignments[6]);
  });

  it('should handle empty input', () => {
    expect(sphericalKMeans([], 3)).toEqual([]);
  });

  it('should handle k greater than vectors length', () => {
    const vectors = [[1, 0], [0, 1]];
    const assignments = sphericalKMeans(vectors, 5, 20, seededRandom);
    expect(assignments.length).toBe(2);
    // Each should get its own cluster
    expect(assignments[0]).not.toBe(assignments[1]);
  });
});
