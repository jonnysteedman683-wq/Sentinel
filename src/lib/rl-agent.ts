import * as tf from '@tensorflow/tfjs';
import { doc, getDoc, setDoc, collection, addDoc, db } from '../firebase.js';
import { RLWeightsDoc, ExperienceTuple } from '../types.js';
import { Option, IdleExplorerOption, DeepConsolidatorOption, HybridSyncRAGOption, SystemSelfRepairOption } from './options.js';
import { 
  TFQNetwork as QNetwork, TFEncoder as Encoder, 
  TFInverseModel as InverseModel, TFForwardModel as ForwardModel 
} from './tf-rl-core.js';
import { zeros, add } from './rl-core.js';

import { ActiveInferenceAgent } from './active-inference.js';
import { PreferenceManager } from './preferences.js';
import { WorldModel } from './world-model.js';

export { zeros, add };

class ReplayBuffer {
  buffer: Array<[number[], number, number, number[]]> = [];
  capacity: number;

  constructor(capacity: number = 2000) {
    this.capacity = capacity;
  }

  push(state: number[], action: number, reward: number, next_state: number[]): void {
    if (this.buffer.length >= this.capacity) {
      this.buffer.shift();
    }
    this.buffer.push([state, action, reward, next_state]);
  }

  sample(batch_size: number): [number[][], number[], number[], number[][]] {
    const batch = [];
    for (let i = 0; i < batch_size; i++) {
      const idx = Math.floor(Math.random() * this.buffer.length);
      batch.push(this.buffer[idx]);
    }
    
    const states = batch.map(b => b[0]);
    const actions = batch.map(b => b[1]);
    const rewards = batch.map(b => b[2]);
    const next_states = batch.map(b => b[3]);
    
    return [states, actions, rewards, next_states];
  }

  get length(): number {
    return this.buffer.length;
  }
}

export type NudgeCallback = () => Promise<void>;
export type ConsolidateCallback = () => Promise<void>;
export type InsightCallback = () => Promise<void>;
export type HybridSyncRAGCallback = () => Promise<void>;

export enum AgentAction {
  IDLE = 0,
  CHANGE_DEPTH = 1,
  CONSOLIDATE = 2,
  NUDGE = 3,
  CONSOLIDATE_CHATS = 4,
  INSIGHT = 5,
  HYBRID_SYNC_RAG = 6,
}

export interface RLDecision {
  type: 'action' | 'option' | 'terminate';
  index?: number;
  optionId?: string;
  efe?: number;
  confidence?: number;
}

export class CuriousAgent {
  state_dim: number;
  n_actions: number;
  gamma: number;
  epsilon: number;
  lr: number;
  q_online: QNetwork;
  q_target: QNetwork;
  buffer: ReplayBuffer;
  encoder: Encoder;
  inverse_model: InverseModel;
  forward_model: ForwardModel;
  
  options: Option[] & { get?: (id: string) => Option | undefined } = [];
  activeOption: Option | null = null;
  optionDuration: number = 0;
  optionInitState: number[] | null = null;

  nudgeCallback?: NudgeCallback;
  consolidateCallback?: ConsolidateCallback;
  insightCallback?: InsightCallback;
  hybridSyncRAGCallback?: HybridSyncRAGCallback;
  
  currentState: number[] = [];
  lastState: number[] = [];
  lastAction: number = 0;
  experienceBuffer: ExperienceTuple[] = [];

  // Active Inference components
  worldModel: WorldModel;
  prefManager: PreferenceManager;
  aiPlanner: ActiveInferenceAgent;
  useActiveInference: boolean = false;

  constructor(
    state_dim: number, 
    n_actions: number, 
    userId: string,
    lr: number = 0.001, 
    gamma: number = 0.99,
    epsilon: number = 1.0
  ) {
    this.state_dim = state_dim;
    this.n_actions = n_actions;
    this.gamma = gamma;
    this.epsilon = epsilon;
    this.lr = lr;
    
    this.q_online = new QNetwork(state_dim, n_actions, this.lr);
    this.q_target = new QNetwork(state_dim, n_actions, this.lr);
    this.buffer = new ReplayBuffer();
    
    const enc_dim = 32;
    this.encoder = new Encoder(state_dim, enc_dim, this.lr);
    this.inverse_model = new InverseModel(enc_dim, n_actions, this.lr);
    this.forward_model = new ForwardModel(enc_dim, n_actions, this.lr);
    
    const opts = [
      new IdleExplorerOption(state_dim, lr),
      new DeepConsolidatorOption(state_dim, lr),
      new HybridSyncRAGOption(state_dim, lr),
      new SystemSelfRepairOption(state_dim, lr)
    ];
    this.options = Object.assign(opts, {
      get: (id: string) => opts.find(o => o.id === id)
    });

    this.worldModel = new WorldModel(state_dim, n_actions);
    this.prefManager = new PreferenceManager(userId);
    this.aiPlanner = new ActiveInferenceAgent(
      this.worldModel,
      this.prefManager,
      this.options as Option[],
      state_dim,
      n_actions,
      userId
    );

    this.currentState = new Array(state_dim).fill(0);
  }


  setNudgeCallback(cb: NudgeCallback) { this.nudgeCallback = cb; }
  setConsolidateCallback(cb: ConsolidateCallback) { this.consolidateCallback = cb; }
  setInsightCallback(cb: InsightCallback) { this.insightCallback = cb; }
  setHybridSyncRAGCallback(cb: HybridSyncRAGCallback) { this.hybridSyncRAGCallback = cb; }

  getState(): number[] {
    return [...this.currentState];
  }

  // Phase 1 Upgrade: Compute live curiosity vector (prediction error per state dimension)
  getCuriosityVector(state: number[], action: number): number[] {
    const enc = this.encoder.forward([state])[0];
    const a_onehot = new Array(this.n_actions).fill(0);
    if (action >= 0 && action < this.n_actions) {
      a_onehot[action] = 1.0;
    }
    const pred_enc = this.forward_model.forward([enc], [a_onehot])[0];
    
    // Compute prediction error as curiosity signal
    const errorMagnitude = enc.reduce((sum, v, i) => sum + Math.abs(v - pred_enc[i]), 0) / enc.length;
    
    // Distribute error magnitude across state dimensions
    return state.map(s => errorMagnitude * Math.abs(s) + (Math.random() * 0.1 * errorMagnitude));
  }

  setDimension(index: number, value: number) {
    if (index >= 0 && index < this.state_dim) {
      this.currentState[index] = value;
    }
  }

  remember(s: number[], a: number | RLDecision, r: number, ns: number[]) {
    const actionIndex = typeof a === 'number' ? a : (a.index ?? (a.type === 'option' ? 99 : 0));
    this.buffer.push(s, actionIndex, r, ns);
    this.experienceBuffer.push({ state: s, action: actionIndex, reward: r, nextState: ns, done: false });
  }

  async flushExperiences(userId: string) {
    if (this.experienceBuffer.length === 0) return;
    try {
      const batchRef = collection(db, 'users', userId, 'rlAgent_replay');
      await addDoc(batchRef, {
        timestamp: Date.now(),
        experiences: [...this.experienceBuffer]
      });
      this.experienceBuffer = [];
    } catch (e) {
      console.error('Failed to flush experiences:', e);
    }
  }

  private mapReward(reward: string | number): number {
    if (typeof reward === 'string') {
      if (reward === 'accept') return 1.0;
      if (reward === 'ignore') return -0.1;
      if (reward === 'reject') return -0.5;
      return 0;
    }
    return reward;
  }

  async applyNudgeReward(reward: string | number) {
    const r = this.mapReward(reward);
    this.remember(this.lastState, AgentAction.NUDGE, r, this.currentState);
    await this.train();
  }

  async applyConsolidationReward(reward: string | number) {
    const r = this.mapReward(reward);
    this.remember(this.lastState, AgentAction.CONSOLIDATE, r, this.currentState);
    await this.train();
  }

  async applyInsightReward(reward: string | number) {
    const r = this.mapReward(reward);
    this.remember(this.lastState, AgentAction.INSIGHT, r, this.currentState);
    await this.train();
  }

  async applyDelayedInsightReward(reward: string | number) {
    await this.applyInsightReward(reward);
  }

  async applyHybridSyncRAGReward(reward: string | number) {
    const r = this.mapReward(reward);
    this.remember(this.lastState, AgentAction.HYBRID_SYNC_RAG, r, this.currentState);
    await this.train();
  }

  async selectActionHRL(state: number[]): Promise<RLDecision> {
    this.lastState = [...state];
    
    // If an option is active, check for termination
    if (this.activeOption) {
      if (this.optionDuration >= this.activeOption.maxDuration || Math.random() < this.activeOption.terminationProbability(state)) {
        this.activeOption = null;
        return { type: 'terminate' };
      }
      this.optionDuration++;
      
      const localActionIndex = this.activeOption.get_action(state);
      const actionName = this.activeOption.actionSpace[localActionIndex];
      const globalActionIndex = AgentAction[actionName as keyof typeof AgentAction];
      return { type: 'action', index: globalActionIndex };
    }

    if (this.useActiveInference) {
      return await this.aiPlanner.selectAction(state);
    }

    const action = this.get_action(state);
    
    if (action < this.options.length) {
      return { type: 'option', optionId: this.options[action].id };
    } else {
      return { type: 'action', index: action };
    }
  }

  async act(state: number[]): Promise<RLDecision> {
    return await this.selectActionHRL(state);
  }


  get_action(state: number[]): number {
    if (Math.random() < this.epsilon) {
      return Math.floor(Math.random() * this.n_actions);
    }
    const q_values = this.q_online.forward([state]);
    return q_values[0].indexOf(Math.max(...q_values[0]));
  }

  async train(): Promise<void> {
    if (this.buffer.length < 64) return;
    
    const [states, actions, rewards, next_states] = this.buffer.sample(32);
    
    // 1. Encode states through the feature network
    const enc_s = this.encoder.forward(states);
    const enc_s_next = this.encoder.forward(next_states);
    
    // 2. Train inverse model: (enc_s, enc_s_next) → action
    //    This makes the encoder learn informative features
    await this.inverse_model.trainStep(enc_s, enc_s_next, actions);
    
    // 3. Train forward model: (enc_s, action) → enc_s_next
    //    Prediction error = intrinsic curiosity reward
    const a_onehot: number[][] = states.map(() => new Array(this.n_actions).fill(0));
    for (let i = 0; i < actions.length; i++) {
      if (actions[i] >= 0 && actions[i] < this.n_actions) {
        a_onehot[i][actions[i]] = 1.0;
      }
    }
    const { intrinsicRewards } = await this.forward_model.trainStep(enc_s, a_onehot, enc_s_next);
    
    // 4. Train encoder to reduce forward model prediction error
    //    (this is what the original code did via manual backprop through the forward model)
    //    We approximate by training the encoder to predict enc_s_next from states
    await this.encoder.trainStep(states, enc_s_next);
    
    // 5. Compute target Q-values using the target network
    const q_next = this.q_target.forwardTarget(next_states);
    const target_q: number[] = [];
    for (let i = 0; i < 32; i++) {
      const max_q_next = Math.max(...(q_next[i] || [0]));
      const total_reward = rewards[i] + (intrinsicRewards[i] || 0);
      target_q.push(total_reward + this.gamma * max_q_next);
    }
    
    // 6. Train the online Q-network with TF.js
    await this.q_online.train_step(states, actions, target_q);
    
    // 7. Decay exploration rate
    this.epsilon = Math.max(0.1, this.epsilon * 0.995);
  }

  update_target(): void {
    this.q_target.syncTarget();
  }

  // Returns the current mean Q-value — real convergence metric for the chart
  getMeanQValue(): number {
    return this.q_online.getMeanQValue();
  }

  async saveWeights(userId: string) {
    try {
      const optionWeights: Record<string, any> = {};
      for (const opt of this.options) {
        if (opt.policy) {
          optionWeights[opt.name] = await (opt.policy as any).serialize();
        }
      }

      const docData: any = {
        updatedAt: Date.now(),
        format: 'tfjs-v2',
        topLevel: await this.q_online.serialize(),
        options: optionWeights,
        icm: {
          encoder: await (this.encoder as any).serialize(),
          forwardModel: await (this.forward_model as any).serialize(),
          inverseModel: await (this.inverse_model as any).serialize(),
        },
        hyperparams: {
          epsilon: this.epsilon,
          learningRate: this.lr,
          discountFactor: this.gamma
        }
      };
      
      await setDoc(doc(db, 'users', userId, 'rlAgent', 'weights'), docData);
      await this.aiPlanner.savePolicyWeights();
    } catch (e) {
      console.error('Failed to save RL weights:', e);
    }
  }

  async loadWeights(userId: string) {
    try {
      const snap = await getDoc(doc(db, 'users', userId, 'rlAgent', 'weights'));
      if (snap.exists()) {
        const data = snap.data() as any;
        
        // Try TF.js v2 format first, fall back to legacy format
        if (data.format === 'tfjs-v2') {
          if (data.hyperparams) {
            this.epsilon = data.hyperparams.epsilon;
            this.lr = data.hyperparams.learningRate;
            this.gamma = data.hyperparams.discountFactor;
          }
          if (data.topLevel) {
            await this.q_online.deserialize(data.topLevel);
            this.update_target();
          }
          for (const opt of this.options) {
            const optData = data.options?.[opt.name];
            if (optData) {
              await (opt.policy as any).deserialize(optData);
            }
          }
          if (data.icm) {
            if (data.icm.encoder) await (this.encoder as any).deserialize(data.icm.encoder);
            if (data.icm.forwardModel) await (this.forward_model as any).deserialize(data.icm.forwardModel);
            if (data.icm.inverseModel) await (this.inverse_model as any).deserialize(data.icm.inverseModel);
          }
        } else {
          // Legacy format: set epsilon and hyperparams, ignore old weight format
          if (data.hyperparams) {
            this.epsilon = data.hyperparams.epsilon;
            this.lr = data.hyperparams.learningRate;
            this.gamma = data.hyperparams.discountFactor;
          }
        }
        await this.aiPlanner.loadPolicyWeights();
      }
    } catch (e) {
      console.error('Failed to load RL weights:', e);
    }
  }
}

export class DQNCuriousAgent {
  private model: tf.Sequential;

  constructor() {
    this.model = tf.sequential({
      layers: [
        tf.layers.dense({ inputShape: [10], units: 24, activation: 'relu' }),
        tf.layers.dense({ units: 5, activation: 'linear' }) 
      ]
    });
  }

  /**
   * Selects an action safely without leaking tensors.
   */
  public predictAction(stateVector: number[]): number {
    // tf.tidy automatically cleans up all intermediate tensors created inside
    return tf.tidy(() => {
      const stateTensor = tf.tensor2d(stateVector, [1, stateVector.length]);
      const qValues = this.model.predict(stateTensor) as tf.Tensor;
      
      // Extract the highest value action index
      const actionTensor = qValues.argMax(1);
      return actionTensor.dataSync()[0]; 
    });
  }

  /**
   * Asynchronous loops cannot use tf.tidy(). Tensors must be tracked and 
   * manually disposed of after the operation completes.
   */
  public async train(batch: tf.Tensor[], targets: tf.Tensor): Promise<void> {
    const inputTensor = tf.concat(batch);
    
    await this.model.fit(inputTensor, targets, { epochs: 1 });
    
    // Explicit C++ memory cleanup
    inputTensor.dispose();
    targets.dispose();
    // Also dispose elements in batch array
    batch.forEach(t => t.dispose());
  }
}

