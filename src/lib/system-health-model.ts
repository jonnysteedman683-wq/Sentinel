import * as tf from '@tensorflow/tfjs';
import { MaintenanceActionType } from '../types.js';

export class SystemHealthModel {
  private model: tf.LayersModel;
  private stateDim: number = 9; // memoryRatio, cpu, workers, queue, fsRead, fsWrite, geminiLat, errors, dreamFail
  private actionDim: number = Object.keys(MaintenanceActionType).length;

  constructor() {
    this.model = tf.sequential({
      layers: [
        tf.layers.dense({ units: 32, activation: 'relu', inputShape: [this.stateDim + this.actionDim] }),
        tf.layers.dense({ units: 16, activation: 'relu' }),
        tf.layers.dense({ units: this.stateDim }) // Predict next state
      ]
    });
    this.model.compile({ optimizer: 'adam', loss: 'meanSquaredError' });
  }

  public predictNext(state: number[], actionIdx: number): number[] {
    return tf.tidy(() => {
      const actionOneHot = new Array(this.actionDim).fill(0);
      actionOneHot[actionIdx] = 1;
      const combined = [...state, ...actionOneHot];
      const input = tf.tensor2d(combined, [1, combined.length]);
      const prediction = this.model.predict(input) as tf.Tensor;
      return Array.from(prediction.dataSync());
    });
  }

  public async train(history: { state: number[], action: number, nextState: number[] }[]) {
    if (history.length === 0) return;

    const xs = history.map(h => {
      const actionOneHot = new Array(this.actionDim).fill(0);
      actionOneHot[h.action] = 1;
      return [...h.state, ...actionOneHot];
    });
    const ys = history.map(h => h.nextState);

    const xTensor = tf.tensor2d(xs, [xs.length, this.stateDim + this.actionDim]);
    const yTensor = tf.tensor2d(ys, [ys.length, this.stateDim]);

    await this.model.fit(xTensor, yTensor, { epochs: 10, verbose: 0 });

    xTensor.dispose();
    yTensor.dispose();
  }

  public async serialize(): Promise<any> {
    const weights = JSON.stringify(this.model.getWeights().map(w => Array.from(w.dataSync())));
    return {
      weights,
      updatedAt: Date.now(),
      stateDim: this.stateDim,
      actionDim: this.actionDim
    };
  }

  public async load(weightsData: any) {
    if (weightsData && typeof weightsData.weights === 'string') {
      try {
        const parsedWeights = JSON.parse(weightsData.weights);
        const tensors = parsedWeights.map((w: any, i: number) => {
          const shape = this.model.getWeights()[i].shape;
          // Ensure w is an array of numbers
          const numericW = Array.isArray(w) ? w.map(v => typeof v === 'number' ? v : 0) : [];
          return tf.tensor(numericW, shape);
        });
        this.model.setWeights(tensors);
        tensors.forEach((t: any) => t.dispose());
        console.log("[SystemHealthModel] Weights loaded successfully.");
      } catch (e) {
        console.warn("[SystemHealthModel] Failed to load weights, using initialized random weights:", e);
      }
    }
  }
}
