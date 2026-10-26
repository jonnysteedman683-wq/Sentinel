import { describe, expect, it } from 'vitest';
import {
  add,
  matmul,
  mean_along_axis1,
  mul_scalar,
  randn,
  relu,
  sub,
  sum_along_axis0,
  transpose,
  zeros,
} from '../rl-core.js';

describe('zeros', () => {
  it('builds a matrix of the given shape filled with 0', () => {
    const m = zeros(2, 3);
    expect(m).toEqual([
      [0, 0, 0],
      [0, 0, 0],
    ]);
  });
});

describe('matmul', () => {
  it('multiplies two conformable matrices', () => {
    const a = [
      [1, 2],
      [3, 4],
    ];
    const b = [
      [5, 6],
      [7, 8],
    ];
    expect(matmul(a, b)).toEqual([
      [19, 22],
      [43, 50],
    ]);
  });

  it('returns an empty matrix for empty inputs', () => {
    expect(matmul([], [[1]])).toEqual([]);
    expect(matmul([[1]], [])).toEqual([]);
  });
});

describe('transpose', () => {
  it('swaps rows and columns', () => {
    expect(transpose([[1, 2, 3]])).toEqual([[1], [2], [3]]);
  });
});

describe('elementwise add / sub / scalar', () => {
  it('adds matrices', () => {
    expect(add([[1, 2]], [[3, 4]])).toEqual([[4, 6]]);
  });

  it('subtracts matrices', () => {
    expect(sub([[1, 2]], [[3, 4]])).toEqual([[-2, -2]]);
  });

  it('scales by a scalar', () => {
    expect(mul_scalar([[1, 2]], 3)).toEqual([[3, 6]]);
  });
});

describe('axis reductions', () => {
  it('means along axis 1 (per row)', () => {
    expect(
      mean_along_axis1([
        [1, 2, 3],
        [4, 5, 6],
      ]),
    ).toEqual([[2], [5]]);
  });

  it('sums along axis 0 (per column)', () => {
    expect(
      sum_along_axis0([
        [1, 2],
        [3, 4],
      ]),
    ).toEqual([[4, 6]]);
  });
});

describe('relu', () => {
  it('clamps negatives to 0 and records the activation mask', () => {
    const { out, mask } = relu([[-1, 0, 2]]);
    expect(out).toEqual([[0, 0, 2]]);
    expect(mask).toEqual([[0, 0, 1]]);
  });
});

describe('randn', () => {
  it('produces a finite matrix of the requested shape', () => {
    const m = randn(3, 4);
    expect(m).toHaveLength(3);
    expect(m[0]).toHaveLength(4);
    for (const row of m) {
      for (const v of row) {
        expect(Number.isFinite(v)).toBe(true);
      }
    }
  });
});
