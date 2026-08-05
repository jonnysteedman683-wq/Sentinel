import { describe, it, expect } from 'vitest';
import { pca2D } from './pca.js';

const seededRandom = (() => {
  let seed = 12345;
  return () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
})();


describe('pca2D', () => {
  it('should project high dimensional data to 2D', () => {
    // 3D points
    const vectors = [
      [1, 0.1, 0.1],
      [0.9, 0.2, 0.1],
      [0, 1, 0.1],
      [0.1, 0.9, 0.2],
      [0, 0, 1],
      [0.1, 0, 0.9]
    ];

    const projected = pca2D(vectors, 50, seededRandom); // using 50 maxIter for better convergence
    
    expect(projected.length).toBe(vectors.length);
    expect(projected[0].length).toBe(2);

    // Assert that the result contains finite numbers
    projected.forEach(pt => {
      expect(Number.isFinite(pt[0])).toBe(true);
      expect(Number.isFinite(pt[1])).toBe(true);
      expect(Number.isNaN(pt[0])).toBe(false);
      expect(Number.isNaN(pt[1])).toBe(false);
    });
  });

  it('should handle empty input', () => {
    expect(pca2D([])).toEqual([]);
  });

  it('should handle 0D vectors', () => {
    expect(pca2D([[]])).toEqual([[0, 0]]);
  });

  it('should handle perfectly identical points gracefully (zero variance)', () => {
    const vectors = [
      [1, 1],
      [1, 1],
      [1, 1]
    ];
    const projected = pca2D(vectors, 40, seededRandom);
    
    // Everything should map to [0, 0] since it's centered and there's no variance
    projected.forEach(pt => {
      expect(pt[0]).toBeCloseTo(0, 5);
      expect(pt[1]).toBeCloseTo(0, 5);
    });
  });
});
