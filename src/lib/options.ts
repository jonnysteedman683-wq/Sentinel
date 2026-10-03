import { TFQNetwork as QNetwork } from './tf-rl-core.js';

export interface Option {
  id: string;
  name: string;
  policy: QNetwork;
  actionSpace: string[];
  maxDuration: number;
  timesActivated?: number;
  successRate?: number;
  
  canInitiate(state: number[]): boolean;
  terminationProbability(state: number[]): number;
  get_action(state: number[], epsilon?: number): number;
  
  onActivate?: () => void;
  onTerminate?: () => void;
}

export class IdleExplorerOption implements Option {
  id = 'idle-explorer';
  name = 'Idle Explorer';
  policy: QNetwork;
  actionSpace = ['NUDGE', 'INSIGHT'];
  maxDuration = 10;
  timesActivated = 0;
  successRate = 1.0;

  constructor(stateDim: number, lr: number = 0.001) {
    this.policy = new QNetwork(stateDim, this.actionSpace.length, lr);
  }

  canInitiate(state: number[]): boolean {
    const userActivity = state[3]; // assuming index 3 is idle/activity
    return userActivity > 0.5;
  }

  terminationProbability(state: number[]): number {
    const userActivity = state[3];
    return userActivity < 0.3 ? 1.0 : 0.05;
  }

  get_action(state: number[], epsilon: number = 0.1): number {
    if (Math.random() < epsilon) {
      return Math.floor(Math.random() * this.actionSpace.length);
    }
    const q = this.policy.forward([state]);
    return q[0].indexOf(Math.max(...q[0]));
  }
}

export class DeepConsolidatorOption implements Option {
  id = 'deep-consolidator';
  name = 'Deep Consolidator';
  policy: QNetwork;
  actionSpace = ['CONSOLIDATE', 'CONSOLIDATE_CHATS'];
  maxDuration = 5;
  timesActivated = 0;
  successRate = 1.0;

  constructor(stateDim: number, lr: number = 0.001) {
    this.policy = new QNetwork(stateDim, this.actionSpace.length, lr);
  }

  canInitiate(state: number[]): boolean {
    const memoryCount = state[1]; // assuming index 1 is memory count
    return memoryCount > 5;
  }

  terminationProbability(state: number[]): number {
    const memoryCount = state[1];
    return memoryCount < 2 ? 0.8 : 0.1;
  }

  get_action(state: number[], epsilon: number = 0.1): number {
    if (Math.random() < epsilon) {
      return Math.floor(Math.random() * this.actionSpace.length);
    }
    const q = this.policy.forward([state]);
    return q[0].indexOf(Math.max(...q[0]));
  }
}

export class HybridSyncRAGOption implements Option {
  id = 'hybrid-sync-rag';
  name = 'Hybrid Sync & Topological RAG';
  policy: QNetwork;
  actionSpace = ['HYBRID_SYNC_RAG'];
  maxDuration = 4;
  timesActivated = 0;
  successRate = 1.0;

  constructor(stateDim: number, lr: number = 0.001) {
    this.policy = new QNetwork(stateDim, this.actionSpace.length, lr);
  }

  canInitiate(state: number[]): boolean {
    const memoryCount = state[1];
    return memoryCount > 3;
  }

  terminationProbability(state: number[]): number {
    const memoryCount = state[1];
    return memoryCount < 2 ? 0.9 : 0.05;
  }

  get_action(state: number[], epsilon: number = 0.1): number {
    if (Math.random() < epsilon) {
      return Math.floor(Math.random() * this.actionSpace.length);
    }
    const q = this.policy.forward([state]);
    return q[0].indexOf(Math.max(...q[0]));
  }
}

export class SystemSelfRepairOption implements Option {
  id = 'system-self-repair';
  name = 'System Self-Repair';
  policy: QNetwork;
  actionSpace = ['RUN_DIAGNOSTIC', 'TRIGGER_GARBAGE_COLLECTION', 'RESTART_IDLE_WORKER'];
  maxDuration = 3;
  timesActivated = 0;
  successRate = 1.0;

  constructor(stateDim: number, lr: number = 0.001) {
    this.policy = new QNetwork(stateDim, this.actionSpace.length, lr);
  }

  canInitiate(state: number[]): boolean {
    const messageCount = state[0];
    const memoryCount = state[1];
    return messageCount > 15 || memoryCount > 10;
  }

  terminationProbability(state: number[]): number {
    const messageCount = state[0];
    return messageCount < 5 ? 0.9 : 0.1;
  }

  get_action(state: number[], epsilon: number = 0.1): number {
    if (Math.random() < epsilon) {
      return Math.floor(Math.random() * this.actionSpace.length);
    }
    const q = this.policy.forward([state]);
    return q[0].indexOf(Math.max(...q[0]));
  }
}
