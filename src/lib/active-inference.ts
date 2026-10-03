import * as tf from '@tensorflow/tfjs';
import { WorldModel } from './world-model.js';
import { PreferenceManager } from './preferences.js';
import { Option } from './options.js';
import { RLDecision } from './rl-agent.js';
import { PolicyNetwork } from './policy-network.js';
import { db, collection, addDoc, doc, getDoc, setDoc } from '../firebase.js';
import { SerializedPolicyNet } from '../types.js';

export class ActiveInferenceAgent {
  private worldModel: WorldModel;
  private prefManager: PreferenceManager;
  private options: Option[];
  protected actionDim: number;
  private userId: string;

  public policyNet?: PolicyNetwork;
  public usePolicyNet: boolean = true;

  constructor(
    worldModel: WorldModel,
    prefManager: PreferenceManager,
    options: Option[],
    stateDim: number,
    actionDim: number,
    userId: string
  ) {
    this.worldModel = worldModel;
    this.prefManager = prefManager;
    this.options = options;
    this.actionDim = actionDim;
    this.userId = userId;
    this.policyNet = new PolicyNetwork(stateDim, actionDim);
  }

  async selectAction(state: number[]): Promise<RLDecision & { efe: number; confidence?: number }> {
    if (this.policyNet && this.usePolicyNet) {
      const { action, confidence } = await this.policyNet.predict(state);
      if (confidence > 0.6) {
        // Record data for future training even if we use policy net (self-distillation)
        this.saveTrainingData(state, action);
        
        const decision: RLDecision & { efe: number; confidence: number } = {
          type: action < this.options.length ? 'option' : 'action',
          efe: 0,
          confidence
        };
        if (decision.type === 'option') {
          decision.optionId = this.options[action].id;
        } else {
          decision.index = action;
        }
        return decision;
      }
    }

    const decision = await this.plan(state);
    const actionIndex = decision.type === 'option' ? 
      this.options.findIndex(o => o.id === decision.optionId) : 
      decision.index!;
    
    this.saveTrainingData(state, actionIndex);
    return decision;
  }

  private async saveTrainingData(state: number[], action: number) {
    try {
      await addDoc(collection(db, 'users', this.userId, 'rlAgent', 'policy', 'trainingData'), {
        state,
        action,
        timestamp: Date.now()
      });
    } catch (e) {
      console.error('Failed to save policy training data:', e);
    }
  }

  async savePolicyWeights() {
    if (!this.policyNet) return;
    try {
      const serialized = await this.policyNet.serialize();
      await setDoc(doc(db, 'users', this.userId, 'rlAgent', 'policyNetwork'), serialized);
    } catch (e) {
      console.error('Failed to save policy network weights:', e);
    }
  }

  async loadPolicyWeights() {
    if (!this.policyNet) return;
    try {
      const snap = await getDoc(doc(db, 'users', this.userId, 'rlAgent', 'policyNetwork'));
      if (snap.exists()) {
        this.policyNet.deserialize(snap.data() as SerializedPolicyNet);
      }
    } catch (e) {
      console.error('Failed to load policy network weights:', e);
    }
  }

  /**
   * Calculates the Expected Free Energy (G) for a single step.
   * G = - EpistemicValue - PragmaticValue
   */
  private calculateStepEFE(
    preds: any,
    mu: tf.Tensor1D,
    invCovDiag: tf.Tensor1D
  ): tf.Scalar {
    return tf.tidy(() => {
      // 1. Epistemic Term: KL( q(z) || p(z) )
      // VRSSM outputs latentMean/LogVar. Prior p(z) is N(0,1).
      const latentVar = tf.exp(preds.latentLogVar).clipByValue(1e-12, 1e12);
      const latentLogVarClipped = tf.log(latentVar);
      const klZ = tf.sum(
        latentVar
          .add(tf.square(preds.latentMean))
          .sub(1)
          .sub(latentLogVarClipped)
      ).mul(0.5);

      // 2. Pragmatic Term: E_q(s') [ log p_pref(s') ]
      // log p_pref(s) = -0.5 * (s-μ)^T Σ^{-1} (s-μ) + const
      const diff = preds.nextStateMean.squeeze().sub(mu);
      // Since invCov is diagonal, quadratic form is sum(diag * diff^2)
      const quad = tf.sum(invCovDiag.mul(tf.square(diff)));
      
      // Expected log-preference under Gaussian prediction
      // E[ (s-μ)^T Σ^{-1} (s-μ) ] = (μ_s - μ)^T Σ^{-1} (μ_s - μ) + Tr(Σ^{-1} Σ_s)
      const predVar = tf.exp(preds.nextStateLogVar.squeeze());
      const traceTerm = tf.sum(invCovDiag.mul(predVar));
      
      const logPref = quad.add(traceTerm).mul(-0.5);

      // G = Epistemic - Pragmatic (minimizing this maximizes both)
      return klZ.sub(logPref) as tf.Scalar;
    });
  }

  /**
   * Evaluates a sequence of actions using the World Model rollouts.
   */
  private async evaluateSequence(
    state: number[],
    actionSeq: number[],
    mu: tf.Tensor1D,
    invCovDiag: tf.Tensor1D
  ): Promise<number> {
    return tf.tidy(() => {
      let totalEFE = 0;
      let currentHidden: tf.Tensor2D | undefined = undefined;
      let currentStateTensor = tf.tensor2d(state, [1, state.length]);

      for (const a of actionSeq) {
        const actionArray = new Array(this.actionDim).fill(0);
        actionArray[a] = 1;
        const actionTensor = tf.tensor2d(actionArray, [1, actionArray.length]);
        
        const preds = this.worldModel.predictStep(currentStateTensor, actionTensor, currentHidden);
        
        const stepEFE = this.calculateStepEFE(preds, mu, invCovDiag);
        totalEFE += stepEFE.dataSync()[0];

        // Sample next state for the next step in rollout (or just use mean)
        currentStateTensor = preds.nextStateMean;
        currentHidden = preds.hidden;
      }

      return totalEFE;
    });
  }

  /**
   * Plans the best action/option by searching the EFE landscape.
   */
  async plan(state: number[], horizon: number = 3): Promise<RLDecision & { efe: number }> {
    const mu = this.prefManager.mu;
    const invCovDiag = this.prefManager.invCovDiag;
    
    let minEFE = Infinity;
    let bestDecision: RLDecision & { efe: number } = { type: 'action', index: 0, efe: 0 };

    // Possible primitives
    const primitivesCount = this.actionDim;
    const sequences = this.generateSequences(primitivesCount, horizon);

    let seqCount = 0;
    for (const seq of sequences) {
      const efe = await this.evaluateSequence(state, seq, mu, invCovDiag);
      if (efe < minEFE) {
        minEFE = efe;
        const bestAction = seq[0];
        
        if (bestAction < this.options.length) {
          bestDecision = { type: 'option', optionId: this.options[bestAction].id, efe };
        } else {
          bestDecision = { type: 'action', index: bestAction, efe };
        }
      }
      seqCount++;
      if (seqCount % 20 === 0) {
        await tf.nextFrame(); // Yield to UI thread to prevent freezing
      }
    }

    mu.dispose();
    invCovDiag.dispose();

    return bestDecision;
  }

  private generateSequences(count: number, length: number): number[][] {
    if (length <= 1) return Array.from({ length: count }, (_, i) => [i]);
    const prev = this.generateSequences(count, length - 1);
    const result: number[][] = [];
    for (const p of prev) {
      for (let i = 0; i < count; i++) {
        result.push([...p, i]);
      }
    }
    return result;
  }
}

export class ActiveInferenceEngine {
  private readonly EPSILON = 1e-12;

  /**
   * Calculates Expected Free Energy (EFE) incorporating KL Divergence
   * between the predicted state and the target preference distribution.
   */
  public calculateExpectedFreeEnergy(
    predictedDistribution: number[], 
    preferenceDistribution: number[]
  ): number {
    let klDivergence = 0;
    
    for (let i = 0; i < predictedDistribution.length; i++) {
      // Clip distributions to prevent 0 and guarantee numerical stability
      const p = Math.max(predictedDistribution[i], this.EPSILON);
      const q = Math.max(preferenceDistribution[i], this.EPSILON);
      
      klDivergence += p * Math.log(p / q);
    }

    // In a full FEP model, Epistemic Value (Information Gain) would be subtracted here.
    // EFE = Pragmatic Value (KL Divergence) - Epistemic Value
    return klDivergence; 
  }
}

