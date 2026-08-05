import { describe, it, expect } from 'vitest';
import { Dense } from '../rl-core.js';

describe('RL Core Components', () => {
  it('Dense layer forward pass matches expected TF graph', () => {
    // 2-layer math validation
    const inDim = 3;
    const outDim = 2;
    const lr = 0.01;
    const dense = new Dense(inDim, outDim, lr);

    // Override weights deterministically
    dense.W = [
      [1.0, 2.0],
      [0.5, -1.0],
      [0.0, 1.0]
    ];
    dense.b = [[0.1, -0.1]];

    const input = [
      [1.0, 1.0, 1.0],
      [2.0, 0.0, 0.0]
    ];

    const output = dense.forward(input);

    expect(output.length).toBe(2);
    expect(output[0].length).toBe(2);

    // W col 0: 1*1 + 1*0.5 + 1*0 = 1.5. Bias = 0.1 -> 1.6
    expect(output[0][0]).toBeCloseTo(1.6, 5);
    // W col 1: 1*2 + 1*-1 + 1*1 = 2.0. Bias = -0.1 -> 1.9
    expect(output[0][1]).toBeCloseTo(1.9, 5);

    // [2, 0, 0] * W + b
    // W col 0: 2*1 + 0 + 0 = 2.0 + b(0.1) = 2.1
    // W col 1: 2*2 + 0 + 0 = 4.0 + b(-0.1) = 3.9
    expect(output[1][0]).toBeCloseTo(2.1, 5);
    expect(output[1][1]).toBeCloseTo(3.9, 5);
  });
});
