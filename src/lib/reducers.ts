import { SystemEvent } from './events.js';

export function getReducer(aggregateId: string) {
  const reducers: Record<string, (state: any, event: SystemEvent) => any> = {
    'dream-cycle': reduceDreamCycle,
    'rl-agent': reduceRLAgent,
    'debate': reduceDebate,
    'system-health': reduceSystemHealth,
  };
  return reducers[aggregateId] || ((s) => s);
}

function reduceDreamCycle(state: any, event: SystemEvent) {
  switch (event.eventType) {
    case 'DREAM_CYCLE_STARTED':
      return { ...state, status: 'running', startTime: event.timestamp };
    case 'DREAM_WORLD_MODEL_TRAINED':
      return { ...state, worldModelLoss: event.payload.loss };
    case 'DREAM_RL_UPDATED':
      return { ...state, rlPolicyGain: event.payload.policyGain };
    case 'DREAM_CYCLE_COMPLETED':
      return { ...state, status: 'completed', completedAt: event.timestamp };
    default: return state;
  }
}

function reduceRLAgent(state: any, _: SystemEvent) {
  return state;
}

function reduceDebate(state: any, _: SystemEvent) {
  return state;
}

function reduceSystemHealth(state: any, _: SystemEvent) {
  return state;
}
