import * as tf from '@tensorflow/tfjs';
import { SerializedPolicyNet } from '../types.js';

export class PolicyNetwork {
  model: tf.Sequential;
  stateDim: number;
  actionDim: number;

  constructor(stateDim: number, actionDim: number) {
    this.stateDim = stateDim;
    this.actionDim = actionDim;
    this.model = tf.sequential();
    this.model.add(tf.layers.dense({ units: 64, activation: 'relu', inputShape: [stateDim] }));
    this.model.add(tf.layers.dense({ units: 32, activation: 'relu' }));
    this.model.add(tf.layers.dense({ units: actionDim, activation: 'softmax' }));
    
    this.model.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'categoricalCrossentropy',
      metrics: ['accuracy']
    });
  }

  async predict(state: number[]): Promise<{ action: number; confidence: number }> {
    return tf.tidy(() => {
      const input = tf.tensor2d(state, [1, state.length]);
      const probs = this.model.predict(input) as tf.Tensor2D;
      const confidence = probs.max().dataSync()[0];
      const action = probs.argMax(1).dataSync()[0];
      return { action, confidence };
    });
  }

  async train(states: number[][], actions: number[], epochs: number = 5): Promise<number> {
    if (states.length === 0) return 0;
    const xs = tf.tensor2d(states, [states.length, this.stateDim]);
    const actionsTensor = tf.tensor1d(actions, 'int32');
    const ys = tf.oneHot(actionsTensor, this.actionDim);
    
    const history = await this.model.fit(xs, ys, {
      epochs,
      batchSize: 32,
      shuffle: true,
      verbose: 0
    });
    
    xs.dispose();
    actionsTensor.dispose();
    ys.dispose();
    
    return history.history.loss[history.history.loss.length - 1] as number;
  }

  async serialize(): Promise<SerializedPolicyNet> {
    const weights = this.model.getWeights();
    const serializedWeights = [];
    for (const w of weights) {
      serializedWeights.push(await w.array());
    }
    return {
      weights: JSON.stringify(serializedWeights),
      updatedAt: Date.now(),
      inputSize: this.stateDim,
      outputSize: this.actionDim
    };
  }

  deserialize(data: SerializedPolicyNet) {
    let parsedWeights: any[] = typeof data.weights === "string" ? JSON.parse(data.weights) : data.weights;
    const tensors = parsedWeights.map((w: any) => tf.tensor(w));
    this.model.setWeights(tensors);
  }
}
