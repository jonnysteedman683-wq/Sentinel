import { QNetwork } from './rl-core.js';

export interface Option {
  id: string;
  name: string;
  policy: QNetwork;
  actionSpace: string[];
  maxDuration: number;
  
  canInitiate(state: number[]): boolean;
  terminationProbability(state: number[]): number;
  get_action(state: number[]): number;
  
  onActivate?: () => void;
  onTerminate?: () => void;
}

export class IdleExplorerOption implements Option {
  id = 'idle-explorer';
  name = 'Idle Explorer';
  policy: QNetwork;
  actionSpace = ['NUDGE', 'INSIGHT'];
  maxDuration = 10;

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

  get_action(state: number[]): number {
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

  get_action(state: number[]): number {
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

  get_action(state: number[]): number {
    const q = this.policy.forward([state]);
    return q[0].indexOf(Math.max(...q[0]));
  }
}

