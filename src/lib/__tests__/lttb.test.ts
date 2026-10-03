import { describe, it, expect } from 'vitest';
import { lttb } from '../lttb.js';

interface Pt {
  x: number;
  y: number;
}

const x = (p: Pt) => p.x;
const y = (p: Pt) => p.y;

function series(n: number): Pt[] {
  return Array.from({ length: n }, (_, i) => ({ x: i, y: Math.sin(i / 3) * 10 }));
}

describe('lttb', () => {
  it('returns the input unchanged when threshold >= data length', () => {
    const data = series(5);
    expect(lttb(data, 5, x, y)).toBe(data);
    expect(lttb(data, 10, x, y)).toBe(data);
  });

  it('returns the input unchanged when threshold is 0', () => {
    const data = series(20);
    expect(lttb(data, 0, x, y)).toBe(data);
  });

  it('downsamples to exactly the requested number of points', () => {
    const data = series(100);
    const out = lttb(data, 10, x, y);
    expect(out).toHaveLength(10);
  });

  it('preserves the first and last data points', () => {
    const data = series(50);
    const out = lttb(data, 8, x, y);
    expect(out[0]).toBe(data[0]);
    expect(out[out.length - 1]).toBe(data[data.length - 1]);
  });

  it('returns a subset of the original points (no synthesized values)', () => {
    const data = series(60);
    const out = lttb(data, 12, x, y);
    for (const p of out) {
      expect(data).toContain(p);
    }
  });
});
