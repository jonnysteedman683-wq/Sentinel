import { describe, it, expect } from 'vitest';
import { CRDTSynapse } from './crdt-synapse.js';

describe('CRDTSynapse', () => {
  it('should initialize empty', () => {
    const crdt = new CRDTSynapse('clientA');
    expect(crdt.getWeight('A', 'B')).toBeCloseTo(0, 5);
  });

  it('should update weights correctly for local client', () => {
    const crdt = new CRDTSynapse('clientA');
    crdt.updateWeight('A', 'B', 5, 100);
    expect(crdt.getWeight('A', 'B')).toBeCloseTo(5, 5);
    expect(crdt.getLastCoaccess('A', 'B')).toBe(100);

    crdt.updateWeight('A', 'B', -2, 105);
    expect(crdt.getWeight('A', 'B')).toBeCloseTo(3, 5);
    expect(crdt.getLastCoaccess('A', 'B')).toBe(105);
  });

  it('should merge states from different clients without conflicts', () => {
    const crdtA = new CRDTSynapse('clientA');
    const crdtB = new CRDTSynapse('clientB');

    // Concurrent independent updates
    crdtA.updateWeight('X', 'Y', 10, 200);
    crdtB.updateWeight('X', 'Y', 15, 205);
    
    // Cross merge
    const payloadA = crdtA.exportState();
    const payloadB = crdtB.exportState();

    crdtA.merge(payloadB);
    crdtB.merge(payloadA);

    // Both should reach the exact same state (25)
    expect(crdtA.getWeight('X', 'Y')).toBeCloseTo(25, 5);
    expect(crdtB.getWeight('X', 'Y')).toBeCloseTo(25, 5);
    
    // LWW timestamp should be 205
    expect(crdtA.getLastCoaccess('X', 'Y')).toBe(205);
    expect(crdtB.getLastCoaccess('X', 'Y')).toBe(205);
  });

  it('should handle idempotent merges', () => {
    const crdtA = new CRDTSynapse('clientA');
    crdtA.updateWeight('A', 'B', 5, 100);
    
    const payloadA = crdtA.exportState();
    crdtA.merge(payloadA); // Self merge

    expect(crdtA.getWeight('A', 'B')).toBeCloseTo(5, 5);
  });

  it('should not dip below zero', () => {
    const crdtA = new CRDTSynapse('clientA');
    crdtA.updateWeight('A', 'B', -10, 100);
    expect(crdtA.getWeight('A', 'B')).toBeCloseTo(0, 5);
  });
});
