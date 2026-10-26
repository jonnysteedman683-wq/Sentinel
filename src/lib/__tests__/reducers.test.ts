import { describe, it, expect } from 'vitest';
import { getReducer } from '../reducers.js';
import { SystemEvent } from '../events.js';

describe('Reducers', () => {
  const baseEvent: Omit<SystemEvent, 'eventType' | 'payload'> = {
    eventId: 'test-event-id',
    aggregateId: 'test-aggregate',
    timestamp: new Date('2023-01-01T00:00:00.000Z'),
    userId: 'test-user',
  };

  describe('getReducer', () => {
    it('returns the dream-cycle reducer', () => {
      const reducer = getReducer('dream-cycle');
      expect(typeof reducer).toBe('function');
    });

    it('returns the rl-agent reducer', () => {
      const reducer = getReducer('rl-agent');
      expect(typeof reducer).toBe('function');
    });

    it('returns the debate reducer', () => {
      const reducer = getReducer('debate');
      expect(typeof reducer).toBe('function');
    });

    it('returns the system-health reducer', () => {
      const reducer = getReducer('system-health');
      expect(typeof reducer).toBe('function');
    });

    it('returns a pass-through reducer for unknown aggregateId', () => {
      const reducer = getReducer('unknown-aggregate');
      const initialState = { foo: 'bar' };
      const event: SystemEvent = { ...baseEvent, eventType: 'TEST', payload: {} };
      expect(reducer(initialState, event)).toBe(initialState);
    });
  });

  describe('reduceDreamCycle', () => {
    const reduceDreamCycle = getReducer('dream-cycle');

    it('handles DREAM_CYCLE_STARTED', () => {
      const initialState = { status: 'idle' };
      const event: SystemEvent = {
        ...baseEvent,
        eventType: 'DREAM_CYCLE_STARTED',
        payload: {},
      };

      const newState = reduceDreamCycle(initialState, event);

      expect(newState).toEqual({
        status: 'running',
        startTime: event.timestamp
      });
      expect(newState).not.toBe(initialState);
    });

    it('handles DREAM_WORLD_MODEL_TRAINED', () => {
      const initialState = { status: 'running' };
      const event: SystemEvent = {
        ...baseEvent,
        eventType: 'DREAM_WORLD_MODEL_TRAINED',
        payload: { loss: 0.123 },
      };

      const newState = reduceDreamCycle(initialState, event);

      expect(newState).toEqual({
        status: 'running',
        worldModelLoss: 0.123
      });
    });

    it('handles DREAM_RL_UPDATED', () => {
      const initialState = { status: 'running' };
      const event: SystemEvent = {
        ...baseEvent,
        eventType: 'DREAM_RL_UPDATED',
        payload: { policyGain: 0.456 },
      };

      const newState = reduceDreamCycle(initialState, event);

      expect(newState).toEqual({
        status: 'running',
        rlPolicyGain: 0.456
      });
    });

    it('handles DREAM_CYCLE_COMPLETED', () => {
      const initialState = { status: 'running' };
      const event: SystemEvent = {
        ...baseEvent,
        eventType: 'DREAM_CYCLE_COMPLETED',
        payload: {},
      };

      const newState = reduceDreamCycle(initialState, event);

      expect(newState).toEqual({
        status: 'completed',
        completedAt: event.timestamp
      });
    });

    it('handles unknown events by returning unchanged state', () => {
      const initialState = { status: 'running' };
      const event: SystemEvent = {
        ...baseEvent,
        eventType: 'UNKNOWN_EVENT',
        payload: {},
      };

      const newState = reduceDreamCycle(initialState, event);

      expect(newState).toBe(initialState);
    });
  });

  describe('reduceRLAgent', () => {
    it('returns state unchanged', () => {
      const reducer = getReducer('rl-agent');
      const initialState = { status: 'active' };
      const event: SystemEvent = { ...baseEvent, eventType: 'TEST', payload: {} };

      const newState = reducer(initialState, event);

      expect(newState).toBe(initialState);
    });
  });

  describe('reduceDebate', () => {
    it('returns state unchanged', () => {
      const reducer = getReducer('debate');
      const initialState = { topic: 'test' };
      const event: SystemEvent = { ...baseEvent, eventType: 'TEST', payload: {} };

      const newState = reducer(initialState, event);

      expect(newState).toBe(initialState);
    });
  });

  describe('reduceSystemHealth', () => {
    it('returns state unchanged', () => {
      const reducer = getReducer('system-health');
      const initialState = { cpu: 50 };
      const event: SystemEvent = { ...baseEvent, eventType: 'TEST', payload: {} };

      const newState = reducer(initialState, event);

      expect(newState).toBe(initialState);
    });
  });
});
