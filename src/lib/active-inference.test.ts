import { describe, it, expect } from 'vitest';
import { ActiveInferenceEngine } from './active-inference.js';

describe('ActiveInferenceEngine', () => {
  it('should calculate Expected Free Energy (KL Divergence) with numerical stability', () => {
    const engine = new ActiveInferenceEngine();
    
    // Exact match case
    const pred1 = [0.2, 0.8];
    const pref1 = [0.2, 0.8];
    const efe1 = engine.calculateExpectedFreeEnergy(pred1, pref1);
    expect(efe1).toBeCloseTo(0.0, 5);

    // Minor divergence case
    const pred2 = [0.3, 0.7];
    const pref2 = [0.2, 0.8];
    const efe2 = engine.calculateExpectedFreeEnergy(pred2, pref2);
    // KL(P||Q) = 0.3*log(0.3/0.2) + 0.7*log(0.7/0.8)
    // = 0.3 * 0.405465 + 0.7 * (-0.133531) = 0.1216 - 0.0934 = 0.0281
    expect(efe2).toBeCloseTo(0.02819, 4);

    // Extreme case (handling 0 with epsilon)
    const pred3 = [1.0, 0.0];
    const pref3 = [0.5, 0.5];
    const efe3 = engine.calculateExpectedFreeEnergy(pred3, pref3);
    // KL = 1.0 * log(1.0/0.5) + epsilon * log(epsilon/0.5)
    // = 0.6931 + 0 = 0.6931
    expect(efe3).toBeGreaterThan(0.69);
  });
});
