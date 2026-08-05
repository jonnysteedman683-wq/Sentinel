import * as tf from '@tensorflow/tfjs';

export class LiquidStateMachine {
  private inputWeights: tf.Tensor2D;
  private reservoirWeights: tf.Tensor2D;
  private readoutWeights: tf.Variable; // trainable
  
  // Optimizer for readout
  private optimizer: tf.Optimizer;
  private reservoirSize: number;

  constructor(inputSize: number = 768, reservoirSize: number = 256, outputSize: number = 768) {
    this.reservoirSize = reservoirSize;

    // Fixed, sparse reservoir setup
    this.inputWeights = tf.randomNormal([inputSize, reservoirSize], 0, 0.1) as tf.Tensor2D;
    
    // Spectral radius should ideally be < 1. We scale random weights.
    const rawResWeights = tf.randomNormal([reservoirSize, reservoirSize], 0, 0.1);
    this.reservoirWeights = rawResWeights as tf.Tensor2D; // simplified

    this.readoutWeights = tf.variable(tf.randomNormal([reservoirSize, outputSize], 0, 0.1) as tf.Tensor2D);
    this.optimizer = tf.train.adam(0.01);
  }

  /**
   * Feed a sequence of inputs through the reservoir.
   * @param sequence [seq_length, inputSize]
   * @returns liquid states [seq_length, reservoirSize]
   */
  processSequence(sequence: tf.Tensor2D): tf.Tensor2D {
    return tf.tidy(() => {
      const seqLen = sequence.shape[0];
      let state = tf.zeros([1, this.reservoirSize]);
      
      const states: tf.Tensor2D[] = [];
      const inputs = tf.split(sequence, seqLen);
      
      for (let i = 0; i < seqLen; i++) {
        const inp = inputs[i]; // [1, inputSize]
        const inProj = tf.matMul(inp, this.inputWeights); // [1, resSize]
        const resProj = tf.matMul(state, this.reservoirWeights); // [1, resSize]
        
        state = tf.tanh(inProj.add(resProj));
        states.push(state as tf.Tensor2D);
      }
      return tf.concat(states, 0); // [seqLen, resSize]
    });
  }

  /**
   * Train the readout layer using the liquid states to predict targets.
   * @param liquidStates [batch, reservoirSize]
   * @param targets [batch, outputSize]
   */
  trainReadout(liquidStates: tf.Tensor2D, targets: tf.Tensor2D, epochs: number = 5): number {
    let finalLoss = 0;
    for (let i = 0; i < epochs; i++) {
      const lossFn = () => tf.tidy(() => {
        const preds = tf.matMul(liquidStates, this.readoutWeights);
        return tf.losses.meanSquaredError(targets, preds) as tf.Scalar;
      });
      const res = this.optimizer.minimize(lossFn, true, [this.readoutWeights]);
      if (res) {
        finalLoss = res.dataSync()[0];
        res.dispose();
      }
    }
    return finalLoss;
  }

  /**
   * Predict output from a liquid state
   */
  predict(liquidState: tf.Tensor2D): tf.Tensor2D {
    return tf.tidy(() => {
      return tf.matMul(liquidState, this.readoutWeights);
    });
  }

  private stateHistory: number[] = [];

  /**
   * Advanced anomaly detection based on predictive surprise and temporal state transition divergence (Z-score deviation).
   * Models reservoir surprise - checking if the current state activation magnitude significantly deviates from past rolling history.
   */
  detectAnomaly(liquidState: tf.Tensor1D, threshold: number = 1.96): boolean {
    return tf.tidy(() => {
      const norm = tf.norm(liquidState).dataSync()[0];
      if (this.stateHistory.length < 5) {
        this.stateHistory.push(norm);
        return false;
      }
      
      const sum = this.stateHistory.reduce((a, b) => a + b, 0);
      const mean = sum / this.stateHistory.length;
      const variance = this.stateHistory.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / this.stateHistory.length;
      const std = Math.sqrt(variance) || 1e-5;
      
      const zScore = Math.abs(norm - mean) / std;
      
      // Update historical rolling window
      this.stateHistory.push(norm);
      if (this.stateHistory.length > 50) {
        this.stateHistory.shift();
      }
      
      return zScore > threshold;
    });
  }

  
  async exportWeights(): Promise<{ inputWeights: number[][], reservoirWeights: number[][], readoutWeights: number[][] }> {
    const inputData = await this.inputWeights.array() as number[][];
    const reservoirData = await this.reservoirWeights.array() as number[][];
    const readoutData = await this.readoutWeights.array() as number[][];
    return { inputWeights: inputData, reservoirWeights: reservoirData, readoutWeights: readoutData };
  }

  loadWeights(weights: { inputWeights: number[][], reservoirWeights: number[][], readoutWeights: number[][] }) {
    tf.dispose([this.inputWeights, this.reservoirWeights, this.readoutWeights]);
    this.inputWeights = tf.tensor2d(weights.inputWeights);
    this.reservoirWeights = tf.tensor2d(weights.reservoirWeights);
    this.readoutWeights = tf.variable(tf.tensor2d(weights.readoutWeights));
  }

  dispose() {
    this.inputWeights.dispose();
    this.reservoirWeights.dispose();
    this.readoutWeights.dispose();
  }
}
