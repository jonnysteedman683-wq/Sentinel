import * as tf from '@tensorflow/tfjs';
import { ExperienceTuple } from '../types.js';

export class WorldModel {
  private stateEmbed: tf.layers.Layer;
  private actionEmbed: tf.layers.Layer;
  private gru: tf.layers.Layer;
  private latentMean: tf.layers.Layer;
  private latentLogVar: tf.layers.Layer;
  private decoderNextStateMean: tf.layers.Layer;
  private decoderNextStateLogVar: tf.layers.Layer;
  private decoderReward: tf.layers.Layer;
  private decoderDone: tf.layers.Layer;

  private actionDim: number;

  constructor(stateDim: number, actionDim: number, latentDim = 16, embedDim = 32) {
    this.actionDim = actionDim;

    // Embeddings
    this.stateEmbed = tf.layers.dense({ units: embedDim, activation: 'relu', name: 'state_embed' });
    this.actionEmbed = tf.layers.dense({ units: embedDim, activation: 'relu', name: 'action_embed' });

    // GRU cell
    this.gru = tf.layers.gru({
      units: embedDim,
      returnState: true,
      returnSequences: false,
      name: 'gru'
    });

    // Latent distribution heads
    this.latentMean = tf.layers.dense({ units: latentDim, name: 'latent_mean' });
    this.latentLogVar = tf.layers.dense({ units: latentDim, name: 'latent_logVar' });

    // Decoder heads
    this.decoderNextStateMean = tf.layers.dense({ units: stateDim, name: 'next_state_mean' });
    this.decoderNextStateLogVar = tf.layers.dense({ units: stateDim, name: 'next_state_logVar' });
    this.decoderReward = tf.layers.dense({ units: 1, name: 'reward' });
    this.decoderDone = tf.layers.dense({ units: 1, activation: 'sigmoid', name: 'done' });
    
    // Build the layers by calling them once with dummy inputs if needed, 
    // but in functional API we'd need a model.
    // We'll manage them as a collection of layers for now.
  }

  // Forward pass for a single step. Returns predictions and latent stats.
  predictStep(
    state: tf.Tensor2D,   // [batch, stateDim]
    action: tf.Tensor2D,  // [batch, actionDim] (one-hot)
    prevHidden?: tf.Tensor2D // [batch, embedDim] initial hidden state
  ): {
    nextStateMean: tf.Tensor2D,
    nextStateLogVar: tf.Tensor2D,
    reward: tf.Tensor2D,
    done: tf.Tensor2D,
    latentMean: tf.Tensor2D,
    latentLogVar: tf.Tensor2D,
    hidden: tf.Tensor2D
  } {
    return tf.tidy(() => {
      const stateEmb = this.stateEmbed.apply(state) as tf.Tensor2D;
      const actEmb = this.actionEmbed.apply(action) as tf.Tensor2D;
      const combined = tf.concat([stateEmb, actEmb], 1); // [batch, 2*embedDim]

      // GRU expects [batch, 1, inputDim] for returnSequences: false but we are using it as a cell
      // Actually, gru.apply expects [batch, seq, dim]
      const combinedSeq = combined.expandDims(1);
      const gruRes = this.gru.apply(combinedSeq, prevHidden ? { initialState: [prevHidden] } : {}) as tf.Tensor2D[];
      const hidden = gruRes[0]; // [batch, embedDim]
      
      const latentMean = this.latentMean.apply(hidden) as tf.Tensor2D;
      const latentLogVar = this.latentLogVar.apply(hidden) as tf.Tensor2D;

      // Sample latent
      const eps = tf.randomNormal(latentMean.shape);
      const latent = tf.add(latentMean, tf.mul(tf.exp(tf.mul(latentLogVar, 0.5)), eps));

      const nextStateMean = this.decoderNextStateMean.apply(latent) as tf.Tensor2D;
      const nextStateLogVar = this.decoderNextStateLogVar.apply(latent) as tf.Tensor2D;
      const reward = this.decoderReward.apply(latent) as tf.Tensor2D;
      const done = this.decoderDone.apply(latent) as tf.Tensor2D;

      return { nextStateMean, nextStateLogVar, reward, done, latentMean, latentLogVar, hidden };
    });
  }

  // Simplified predict for rollouts
  predict(state: number[], action: number, hidden?: number[]): { nextState: number[], reward: number, done: boolean, hidden: number[] } {
    return tf.tidy(() => {
      const s = tf.tensor2d(state, [1, state.length]);
      const actionOneHot = new Array(this.actionDim).fill(0);
      actionOneHot[action] = 1;
      const a = tf.tensor2d(actionOneHot, [1, actionOneHot.length]);
      const h = hidden ? tf.tensor2d(hidden, [1, hidden.length]) : undefined;
      
      const res = this.predictStep(s, a, h);
      
      // Sample next state
      const std = tf.exp(tf.mul(res.nextStateLogVar, 0.5));
      const noise = tf.randomNormal(res.nextStateMean.shape);
      const nextStateTensor = tf.add(res.nextStateMean, tf.mul(std, noise));
      
      return {
        nextState: Array.from(nextStateTensor.dataSync()),
        reward: res.reward.dataSync()[0],
        done: res.done.dataSync()[0] > 0.5,
        hidden: Array.from(res.hidden.dataSync())
      };
    });
  }

  async trainBatch(experiences: ExperienceTuple[], epochs: number = 5): Promise<number> {
    if (experiences.length === 0) return 0;
    
    const optimizer = tf.train.adam(0.001);
    const klWeight = 0.1;
    
    // We treat each experience as a sequence of length 1 for simplicity in this implementation,
    // although the VRSSM benefit comes from longer sequences.
    
    let totalLoss = 0;
    
    for (let epoch = 0; epoch < epochs; epoch++) {
      const loss = tf.tidy(() => {
        const s = tf.tensor2d(experiences.map(e => e.state), [experiences.length, experiences[0].state.length]);
        const a = tf.tensor2d(experiences.map(e => {
          const arr = new Array(this.actionDim).fill(0);
          arr[e.action] = 1;
          return arr;
        }), [experiences.length, this.actionDim]);
        const ns = tf.tensor2d(experiences.map(e => e.nextState), [experiences.length, experiences[0].nextState.length]);
        const r = tf.tensor2d(experiences.map(e => [e.reward]), [experiences.length, 1]);
        const d = tf.tensor2d(experiences.map(e => [e.done ? 1 : 0]), [experiences.length, 1]);

        const grads = tf.variableGrads(() => {
          const preds = this.predictStep(s, a);
          
          // State likelihood (Gaussian NLL)
          const nsDiff = tf.sub(ns, preds.nextStateMean);
          const stateLoss = tf.mean(tf.add(
            preds.nextStateLogVar,
            tf.square(nsDiff).div(tf.exp(preds.nextStateLogVar).add(1e-6))
          )).mul(0.5);

          // Reward MSE
          const rewardLoss = tf.losses.meanSquaredError(r, preds.reward);
          // Done Binary Cross Entropy
          const doneLoss = tf.losses.sigmoidCrossEntropy(d, preds.done);
          
          // KL Divergence
          const latentVar = tf.exp(preds.latentLogVar).clipByValue(1e-12, 1e12);
          const latentLogVarClipped = tf.log(latentVar);
          const kl = tf.mean(
            latentVar.add(tf.square(preds.latentMean)).sub(1).sub(latentLogVarClipped)
          ).mul(0.5);

          return stateLoss.add(rewardLoss).add(doneLoss).add(kl.mul(klWeight)) as tf.Scalar;
        });

        (optimizer as any).applyGradients(grads.grads);
        const lossVal = grads.value.dataSync()[0];
        tf.dispose(grads.grads);
        tf.dispose(grads.value);
        return lossVal;
      });
      totalLoss += loss;
    }

    optimizer.dispose();
    
    return totalLoss / epochs;
  }

  async save(): Promise<{ weights: number[][] }> {
    const allLayers = [
      this.stateEmbed, this.actionEmbed, this.gru, 
      this.latentMean, this.latentLogVar, 
      this.decoderNextStateMean, this.decoderNextStateLogVar, 
      this.decoderReward, this.decoderDone
    ];
    
    const weights: number[][] = [];
    allLayers.forEach(l => {
      l.getWeights().forEach(w => {
        weights.push(Array.from(w.dataSync()));
      });
    });
    
    return { weights };
  }

  async load(weightsData: number[][]) {
    const allLayers = [
      this.stateEmbed, this.actionEmbed, this.gru, 
      this.latentMean, this.latentLogVar, 
      this.decoderNextStateMean, this.decoderNextStateLogVar, 
      this.decoderReward, this.decoderDone
    ];
    
    let weightIdx = 0;
    allLayers.forEach(l => {
      const layerWeights = l.getWeights();
      const newWeights = layerWeights.map(w => {
        const tensor = tf.tensor(weightsData[weightIdx], w.shape);
        weightIdx++;
        return tensor;
      });
      l.setWeights(newWeights);
      newWeights.forEach(t => t.dispose());
    });
  }
}
