export type { RLDecision } from './rl-agent-core.js';

export class CuriousAgent {
  private worker: Worker;
  private messageCallbacks = new Map<string, { resolve: Function, reject: Function }>();
  
  public state_dim: number;
  public currentState: number[];

  public nudgeCallback?: (msg?: any) => void;
  public consolidateCallback?: (msg?: any) => void;
  public insightCallback?: (msg?: any) => void;
  public hybridSyncRAGCallback?: (msg?: any) => void;

  public epsilon: number = 1.0;
  public activeOption: any = null;
  public options: any[] = [];
  public optionInitState: any = null;
  private _useActiveInference: boolean = false;
  get useActiveInference(): boolean { return this._useActiveInference; }
  set useActiveInference(value: boolean) {
    this._useActiveInference = value;
    this.postMessageAsync('setUseActiveInference', [value]).catch(console.error);
  }

  constructor(state_dim: number, n_actions: number, userId: string, lr: number = 0.001, gamma: number = 0.99, epsilon: number = 1.0) {
    this.state_dim = state_dim;
    this.currentState = new Array(state_dim).fill(0);
    this.epsilon = epsilon;
    
    if (typeof window === 'undefined' || typeof Worker === 'undefined') {
      this.worker = {} as Worker;
    } else {
      this.worker = new Worker(new URL('./rl.worker.ts', import.meta.url), { type: 'module' });
      this.worker.onmessage = (e) => {
        if (e.data.type === 'EVENT') {
          if (e.data.event === 'nudgeCallback') this.nudgeCallback?.(e.data.data);
          if (e.data.event === 'consolidateCallback') this.consolidateCallback?.(e.data.data);
          if (e.data.event === 'insightCallback') this.insightCallback?.(e.data.data);
          if (e.data.event === 'hybridSyncRAGCallback') this.hybridSyncRAGCallback?.(e.data.data);
          if (e.data.event === 'SYNC_STATE') {
             this.epsilon = e.data.data.epsilon;
             this.activeOption = e.data.data.activeOption;
             this.options = e.data.data.options;
             this.optionInitState = e.data.data.optionInitState;
             this._useActiveInference = e.data.data.useActiveInference;
          }
        } else {
          const { id, status, data, error } = e.data;
          const cb = this.messageCallbacks.get(id);
          if (cb) {
            if (status === 'success') cb.resolve(data);
            else cb.reject(new Error(error));
            this.messageCallbacks.delete(id);
          }
        }
      };
      
      this.postMessageAsync('INIT', [state_dim, n_actions, userId, lr, gamma, epsilon]).catch(console.error);
    }
  }

  private async postMessageAsync(method: string, args: any[] = []): Promise<any> {
    if (typeof window === 'undefined' || typeof Worker === 'undefined') return Promise.resolve();
    return new Promise((resolve, reject) => {
      const id = Date.now().toString() + Math.random().toString();
      this.messageCallbacks.set(id, { resolve, reject });
      this.worker.postMessage({ id, method, args });
    });
  }

  getState(): number[] { return [...this.currentState]; }
  setDimension(index: number, value: number) {
    if (index >= 0 && index < this.state_dim) {
      this.currentState[index] = value;
    }
  }

  async loadWeights(userId: string) { return this.postMessageAsync('loadWeights', [userId]); }
  async saveWeights(userId: string) { return this.postMessageAsync('saveWeights', [userId]); }
  async flushExperiences(userId: string) { return this.postMessageAsync('flushExperiences', [userId]); }
  
  async act(state: number[]) { return this.postMessageAsync('act', [state]); }
  async selectActionHRL(state: number[]) { return this.postMessageAsync('selectActionHRL', [state]); }
  
  async getQValues(state: number[]): Promise<number[]> { return this.postMessageAsync('getQValues', [state]); }
  
  async applyDelayedInsightReward(reward: number, id?: string) { return this.postMessageAsync('applyDelayedInsightReward', [reward, id]); }
  async applyDelayedReward(id: string, type: string | number) { return this.postMessageAsync('applyDelayedReward', [id, type]); }
  
  applyInsightReward(type: string | number) { this.postMessageAsync('applyInsightReward', [type]).catch(console.error); }
  applyNudgeReward(type: string | number) { this.postMessageAsync('applyNudgeReward', [type]).catch(console.error); }
  applyConsolidationReward(type: string | number) { this.postMessageAsync('applyConsolidationReward', [type]).catch(console.error); }
  applyHybridSyncRAGReward(type: string | number) { this.postMessageAsync('applyHybridSyncRAGReward', [type]).catch(console.error); }
  
  registerDelayedTrajectory(id: string, state: number[], action: number, nextState: number[], type: string) {
    this.postMessageAsync('registerDelayedTrajectory', [id, state, action, nextState, type]).catch(console.error);
  }
  remember(state: number[], action: number, reward: number, nextState: number[]) {
    this.postMessageAsync('remember', [state, action, reward, nextState]).catch(console.error);
  }
  train() {
    this.postMessageAsync('train', []).catch(console.error);
  }

  setNudgeCallback(cb: any) { this.nudgeCallback = cb; }
  setConsolidateCallback(cb: any) { this.consolidateCallback = cb; }
  setInsightCallback(cb: any) { this.insightCallback = cb; }
  setHybridSyncRAGCallback(cb: any) { this.hybridSyncRAGCallback = cb; }
}
