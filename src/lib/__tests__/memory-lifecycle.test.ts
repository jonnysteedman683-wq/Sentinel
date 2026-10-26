import { Timestamp } from 'firebase/firestore';
import { describe, expect, it, vi } from 'vitest';
import type { MemoryNode } from '../../types.js';

// The functions under test are pure, but the module pulls in Firestore / AI /
// event dependencies at import time. Stub them so importing the module never
// touches Firebase or the network.
vi.mock('../firestore-shim.js', () => ({ dbShim: {} }));
vi.mock('../events.js', () => ({ publishEvent: vi.fn() }));
vi.mock('../ai-service.js', () => ({ callGeminiGenerate: vi.fn() }));

import {
  applyDecay,
  computeDecayedStrength,
  getStateTransition,
  reinforceMemory,
} from '../memory-lifecycle.js';

const HOUR_MS = 60 * 60 * 1000;

function makeMemory(overrides: Partial<MemoryNode> = {}): MemoryNode {
  const base = new Date('2026-01-01T00:00:00Z');
  return {
    id: 'mem-1',
    content: 'a thought',
    summary: 'gist',
    embedding: [0, 0, 0],
    tags: [],
    strength: 0.8,
    state: 'longTerm',
    createdAt: Timestamp.fromDate(base),
    lastAccessed: Timestamp.fromDate(base),
    accessCount: 0,
    decayRate: 0.001,
    linkedMemories: [],
    userId: 'user-1',
    ...overrides,
  };
}

describe('memory-lifecycle', () => {
  describe('computeDecayedStrength', () => {
    it('returns the current strength when no time has elapsed', () => {
      const base = new Date('2026-01-01T00:00:00Z');
      const mem = makeMemory({ strength: 0.8, lastAccessed: Timestamp.fromDate(base) });
      expect(computeDecayedStrength(mem, base)).toBeCloseTo(0.8, 10);
    });

    it('decays strength exponentially over elapsed hours', () => {
      const base = new Date('2026-01-01T00:00:00Z');
      // ephemeral lambda = 0.01, accessCount 0 => accessBoost 1
      const mem = makeMemory({
        strength: 1,
        state: 'ephemeral',
        lastAccessed: Timestamp.fromDate(base),
      });
      const now = new Date(base.getTime() + 100 * HOUR_MS);
      // 1 * exp(-0.01 * 100 / 1) = exp(-1)
      expect(computeDecayedStrength(mem, now)).toBeCloseTo(Math.exp(-1), 6);
    });

    it('decays more slowly for higher access counts (accessBoost)', () => {
      const base = new Date('2026-01-01T00:00:00Z');
      const now = new Date(base.getTime() + 100 * HOUR_MS);
      const cold = makeMemory({
        strength: 1,
        state: 'ephemeral',
        accessCount: 0,
        lastAccessed: Timestamp.fromDate(base),
      });
      const hot = makeMemory({
        strength: 1,
        state: 'ephemeral',
        accessCount: 10,
        lastAccessed: Timestamp.fromDate(base),
      });
      expect(computeDecayedStrength(hot, now)).toBeGreaterThan(computeDecayedStrength(cold, now));
    });

    it('decays core memories more slowly than ephemeral ones', () => {
      const base = new Date('2026-01-01T00:00:00Z');
      const now = new Date(base.getTime() + 100 * HOUR_MS);
      const ephemeral = makeMemory({
        strength: 1,
        state: 'ephemeral',
        lastAccessed: Timestamp.fromDate(base),
      });
      const core = makeMemory({
        strength: 1,
        state: 'core',
        lastAccessed: Timestamp.fromDate(base),
      });
      expect(computeDecayedStrength(core, now)).toBeGreaterThan(
        computeDecayedStrength(ephemeral, now),
      );
    });

    it('protects memories from decay under high arousal / positive valence', () => {
      const base = new Date('2026-01-01T00:00:00Z');
      const now = new Date(base.getTime() + 100 * HOUR_MS);
      const mem = makeMemory({
        strength: 1,
        state: 'ephemeral',
        lastAccessed: Timestamp.fromDate(base),
      });
      const neutral = computeDecayedStrength(mem, now);
      const excited = computeDecayedStrength(mem, now, { v: 0.8, a: 0.9, d: 0 });
      expect(excited).toBeGreaterThan(neutral);
    });

    it('accepts the legacy "arousal" alias for the arousal component', () => {
      const base = new Date('2026-01-01T00:00:00Z');
      const now = new Date(base.getTime() + 100 * HOUR_MS);
      const mem = makeMemory({
        strength: 1,
        state: 'ephemeral',
        lastAccessed: Timestamp.fromDate(base),
      });
      const viaA = computeDecayedStrength(mem, now, { v: 0, a: 0.9 });
      const viaArousal = computeDecayedStrength(mem, now, { v: 0, arousal: 0.9 });
      expect(viaArousal).toBeCloseTo(viaA, 10);
    });

    it('clamps the stability factor at its lower bound for extreme negative VAD', () => {
      const base = new Date('2026-01-01T00:00:00Z');
      const now = new Date(base.getTime() + 100 * HOUR_MS);
      const mem = makeMemory({
        strength: 1,
        state: 'ephemeral',
        lastAccessed: Timestamp.fromDate(base),
      });
      // stabilityFactor clamps to 0.3 => lambda = 0.01 / 0.3
      const expected = Math.exp((-(0.01 / 0.3) * 100) / 1);
      expect(computeDecayedStrength(mem, now, { v: -100, a: -100, d: 0 })).toBeCloseTo(expected, 6);
    });

    it('clamps the stability factor at its upper bound for extreme positive VAD', () => {
      const base = new Date('2026-01-01T00:00:00Z');
      const now = new Date(base.getTime() + 100 * HOUR_MS);
      const mem = makeMemory({
        strength: 1,
        state: 'ephemeral',
        lastAccessed: Timestamp.fromDate(base),
      });
      // stabilityFactor clamps to 3.0 => lambda = 0.01 / 3
      const expected = Math.exp((-(0.01 / 3) * 100) / 1);
      expect(computeDecayedStrength(mem, now, { v: 100, a: 100, d: 0 })).toBeCloseTo(expected, 6);
    });
  });

  describe('applyDecay', () => {
    it('returns a new object without mutating the original', () => {
      const mem = makeMemory({ strength: 0.8 });
      const result = applyDecay(mem);
      expect(result).not.toBe(mem);
      expect(mem.strength).toBe(0.8);
    });

    it('never produces a negative strength', () => {
      const base = new Date('2026-01-01T00:00:00Z');
      const mem = makeMemory({
        strength: 0.0001,
        state: 'ephemeral',
        lastAccessed: Timestamp.fromDate(base),
      });
      const result = applyDecay(mem);
      expect(result.strength).toBeGreaterThanOrEqual(0);
    });
  });

  describe('reinforceMemory', () => {
    it('increases strength by the default boost and bumps the access count', () => {
      const mem = makeMemory({ strength: 0.5, accessCount: 2 });
      const result = reinforceMemory(mem);
      expect(result.strength).toBeCloseTo(0.6, 10);
      expect(result.accessCount).toBe(3);
    });

    it('honours a custom boost', () => {
      const mem = makeMemory({ strength: 0.5 });
      expect(reinforceMemory(mem, 0.25).strength).toBeCloseTo(0.75, 10);
    });

    it('caps strength at 1', () => {
      const mem = makeMemory({ strength: 0.95 });
      expect(reinforceMemory(mem, 0.2).strength).toBe(1);
    });

    it('does not mutate the original memory', () => {
      const mem = makeMemory({ strength: 0.5, accessCount: 1 });
      reinforceMemory(mem);
      expect(mem.strength).toBe(0.5);
      expect(mem.accessCount).toBe(1);
    });
  });

  describe('getStateTransition', () => {
    it('promotes ephemeral -> shortTerm above 0.6', () => {
      expect(getStateTransition(makeMemory({ state: 'ephemeral', strength: 0.61 })).state).toBe(
        'shortTerm',
      );
    });

    it('promotes shortTerm -> longTerm above 0.8', () => {
      expect(getStateTransition(makeMemory({ state: 'shortTerm', strength: 0.81 })).state).toBe(
        'longTerm',
      );
    });

    it('promotes longTerm -> core above 0.95', () => {
      expect(getStateTransition(makeMemory({ state: 'longTerm', strength: 0.96 })).state).toBe(
        'core',
      );
    });

    it('does not promote at the exact threshold (strictly greater than)', () => {
      expect(getStateTransition(makeMemory({ state: 'ephemeral', strength: 0.6 })).state).toBe(
        'ephemeral',
      );
    });

    it.each([
      ['ephemeral', 0.04, 'forgotten'],
      ['shortTerm', 0.09, 'forgotten'],
      ['longTerm', 0.19, 'forgotten'],
      ['core', 0.29, 'forgotten'],
      ['wisdom', 0.49, 'forgotten'],
    ] as const)('forgets %s memories below their floor', (state, strength, expected) => {
      expect(getStateTransition(makeMemory({ state, strength })).state).toBe(expected);
    });

    it('leaves a memory unchanged when it sits between thresholds', () => {
      const mem = makeMemory({ state: 'ephemeral', strength: 0.3 });
      expect(getStateTransition(mem)).toEqual(mem);
    });

    it.each(['forgotten', 'transformed'] as const)('treats %s as a terminal state', (state) => {
      const mem = makeMemory({ state, strength: 0.99 });
      expect(getStateTransition(mem)).toBe(mem);
    });
  });
});
