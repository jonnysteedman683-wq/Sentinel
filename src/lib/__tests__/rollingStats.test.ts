import { describe, it, expect, beforeEach } from 'vitest';
import { RollingStats } from '../rollingStats.js';

describe('RollingStats', () => {
  let stats: RollingStats;

  beforeEach(() => {
    stats = new RollingStats();
  });

  it('has correct initial state', () => {
    expect(stats.size).toBe(0);
    expect(stats.average).toBe(0);
    expect(stats.stdDev).toBe(0);
  });

  it('updates correctly with a single value', () => {
    stats.update(5);
    expect(stats.size).toBe(1);
    expect(stats.average).toBe(5);
    expect(stats.stdDev).toBe(0);
  });

  it('calculates average and standard deviation for multiple values', () => {
    const values = [2, 4, 4, 4, 5, 5, 7, 9];
    values.forEach(v => stats.update(v));

    expect(stats.size).toBe(8);
    expect(stats.average).toBe(5);
    // sample standard deviation of [2, 4, 4, 4, 5, 5, 7, 9]
    expect(stats.stdDev).toBeCloseTo(2.138089935299395, 5);
  });

  it('handles negative values correctly', () => {
    const values = [-5, -1, 3];
    values.forEach(v => stats.update(v));

    expect(stats.size).toBe(3);
    expect(stats.average).toBe(-1);
    // mean = -1
    // (-5 - -1)^2 = (-4)^2 = 16
    // (-1 - -1)^2 = 0
    // (3 - -1)^2 = 4^2 = 16
    // sum = 32, variance = 32 / (3 - 1) = 16
    // stdDev = 4
    expect(stats.stdDev).toBe(4);
  });

  it('returns zero standard deviation for identical values', () => {
    stats.update(7);
    stats.update(7);
    stats.update(7);

    expect(stats.size).toBe(3);
    expect(stats.average).toBe(7);
    expect(stats.stdDev).toBe(0);
  });
});
