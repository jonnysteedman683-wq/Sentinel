import { describe, it, expect } from 'vitest';
import { getThoughtEmbedding } from '../thoughtEmbedding.js';

describe('getThoughtEmbedding', () => {
  it('returns a 768-dimensional vector', async () => {
    const vec = await getThoughtEmbedding('hello world');
    expect(vec).toHaveLength(768);
  });

  it('is deterministic for the same input', async () => {
    const a = await getThoughtEmbedding('quantum brain');
    const b = await getThoughtEmbedding('quantum brain');
    expect(a).toEqual(b);
  });

  it('keeps every component within the expected bounds', async () => {
    const vec = await getThoughtEmbedding('bounded values please');
    for (const v of vec) {
      expect(Number.isFinite(v)).toBe(true);
      expect(Math.abs(v)).toBeLessThanOrEqual(0.1);
    }
  });

  it('handles the empty string without throwing', async () => {
    const vec = await getThoughtEmbedding('');
    expect(vec).toHaveLength(768);
    expect(vec.every((v) => v === 0)).toBe(true);
  });
});
