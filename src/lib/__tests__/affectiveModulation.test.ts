import { describe, expect, it } from 'vitest';
import { applyAffectiveModulation } from '../affectiveModulation.js';

// Minimal structural stub of DebateAgent — the function only reads/writes
// preferences.mu, so we avoid importing the (tfjs-heavy) debate engine.
interface AgentStub {
  preferences: { mu: number[]; invCov: number[][] };
}

// mu indices: [coherence, novelty, factuality, turnParity, agreement, tension]
function makeAgent(mu: number[]): AgentStub {
  return { preferences: { mu: [...mu], invCov: [] } };
}

const neutral = () => makeAgent([0.5, 0.5, 0.5, 0.5, 0.5, 0.5]);

describe('applyAffectiveModulation', () => {
  it('lowers tension and raises agreement under stress (high arousal, negative valence)', () => {
    const agent = neutral();
    applyAffectiveModulation(agent as never, { v: -0.5, a: 0.8, d: 0 });
    expect(agent.preferences.mu[5]).toBeCloseTo(0.3); // tension down
    expect(agent.preferences.mu[4]).toBeCloseTo(0.7); // agreement up
  });

  it('raises novelty when arousal is low (boredom)', () => {
    const agent = neutral();
    applyAffectiveModulation(agent as never, { v: 0, a: -0.5, d: 0 });
    expect(agent.preferences.mu[1]).toBeCloseTo(0.7);
  });

  it('raises coherence and factuality when dominance is low', () => {
    const agent = neutral();
    applyAffectiveModulation(agent as never, { v: 0, a: 0, d: -0.5 });
    expect(agent.preferences.mu[0]).toBeCloseTo(0.7);
    expect(agent.preferences.mu[2]).toBeCloseTo(0.7);
  });

  it('leaves preferences unchanged for a neutral VAD state', () => {
    const agent = neutral();
    applyAffectiveModulation(agent as never, { v: 0, a: 0, d: 0 });
    expect(agent.preferences.mu).toEqual([0.5, 0.5, 0.5, 0.5, 0.5, 0.5]);
  });

  it('clamps adjusted values into the [0, 1] range', () => {
    const agent = makeAgent([0.95, 0.5, 0.95, 0.5, 0.95, 0.1]);
    applyAffectiveModulation(agent as never, { v: -0.5, a: 0.8, d: -0.5 });
    for (const value of agent.preferences.mu) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
  });
});
