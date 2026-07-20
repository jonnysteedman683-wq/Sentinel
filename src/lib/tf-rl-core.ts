/**
 * TF.js-based Neural Networks for RL — replaces hand-rolled implementations in rl-core.ts
 * Uses GPU-accelerated training with Adam optimizer instead of manual SGD/backprop.
 * Interface-compatible with the original classes so CuriousAgent can swap them in.
 */
import * as tf from '@tensorflow/tfjs';

// ─── QNetwork (DQN) ─────────────────────────────────────────────
// 3-layer dense network: state_dim → 64 → 64 → n_actions
// Trains via model.fit() with Adam optimizer and MSE loss
export class TFQNetwork {
  model: tf.Sequential;
  targetModel: tf.Sequential;
  state_dim: number;
  n_actions: number;
  lr: number;

  constructor(state_dim: number, n_actions: number, lr: number = 0.001) {
    this.state_dim = state_dim;
    this.n_actions = n_actions;
    this.lr = lr;

    const buildNet = () => {
      const m = tf.sequential();
      m.add(tf.layers.dense({ units: 64, activation: 'relu', inputShape: [state_dim], kernelInitializer: 'glorotUniform' }));
      m.add(tf.layers.dense({ units: 64, activation: 'relu', kernelInitializer: 'glorotUniform' }));
      m.add(tf.layers.dense({ units: n_actions, activation: 'linear', kernelInitializer: 'glorotUniform' }));
      return m;
    };

    this.model = buildNet();
    this.model.compile({ optimizer: tf.train.adam(lr), loss: 'meanSquaredError' });

    this.targetModel = buildNet();
    this.syncTarget();
  }

  forward(s: number[][]): number[][] {
    return tf.tidy(() => {
      const input = tf.tensor2d(s);
      const output = this.model.predict(input) as tf.Tensor;
      return output.arraySync() as number[][];
    });
  }

  forwardTarget(s: number[][]): number[][] {
    return tf.tidy(() => {
      const input = tf.tensor2d(s);
      const output = this.targetModel.predict(input) as tf.Tensor;
      return output.arraySync() as number[][];
    });
  }

  async train_step(s: number[][], actions: number[], target_q: number[], isOffline: boolean = false): Promise<number> {
    // Build target Q-matrix: keep predicted Q-values but replace the taken action's Q with target
    const currentQ = this.forward(s);
    const targetQMatrix = currentQ.map((qValues, i) => {
      const newQ = [...qValues];
      newQ[actions[i]] = target_q[i];
      return newQ;
    });

    const xs = tf.tensor2d(s);
    const ys = tf.tensor2d(targetQMatrix);

    const history = await this.model.fit(xs, ys, {
      epochs: 1,
      batchSize: s.length,
      verbose: 0
    });

    xs.dispose();
    ys.dispose();

    return history.history.loss[0] as number;
  }

  syncTarget(): void {
    const weights = this.model.getWeights();
    const targetWeights = weights.map(w => w.clone());
    this.targetModel.setWeights(targetWeights);
    weights.forEach(w => w.dispose());
  }

  // Returns mean Q-value across all actions for a zero state — used for convergence tracking
  getMeanQValue(): number {
    return tf.tidy(() => {
      const input = tf.zeros([1, this.state_dim]);
      const output = this.model.predict(input) as tf.Tensor;
      return output.mean().dataSync()[0];
    });
  }

  // Returns max Q-value for a given state — the value the agent is optimizing
  getMaxQValue(state: number[]): number {
    return tf.tidy(() => {
      const input = tf.tensor2d([state]);
      const output = this.model.predict(input) as tf.Tensor;
      return output.max().dataSync()[0];
    });
  }

  async serialize(): Promise<{ weights: number[][] }> {
    const weights = this.model.getWeights();
    const serialized: number[][] = [];
    for (const w of weights) {
      serialized.push(await w.array() as number[]);
    }
    return { weights: serialized };
  }

  async deserialize(data: { weights: number[][] }): Promise<void> {
    if (!data?.weights?.length) return;
    const tensors = data.weights.map(w => tf.tensor(w));
    this.model.setWeights(tensors);
    this.syncTarget();
    tensors.forEach(t => t.dispose());
  }
}

// ─── Encoder ───────────────────────────────────────────────────
// Maps state → feature encoding (enc_dim-dimensional)
export class TFEncoder {
  model: tf.Sequential;
  state_dim: number;
  enc_dim: number;
  lr: number;

  constructor(input_dim: number, enc_dim: number, lr: number = 0.001) {
    this.state_dim = input_dim;
    this.enc_dim = enc_dim;
    this.lr = lr;

    this.model = tf.sequential();
    this.model.add(tf.layers.dense({ units: enc_dim, activation: 'relu', inputShape: [input_dim], kernelInitializer: 'glorotUniform' }));
    this.model.compile({ optimizer: tf.train.adam(lr), loss: 'meanSquaredError' });
  }

  forward(s: number[][]): number[][] {
    return tf.tidy(() => {
      const input = tf.tensor2d(s);
      const output = this.model.predict(input) as tf.Tensor;
      return output.arraySync() as number[][];
    });
  }

  // Train encoder to minimize reconstruction/prediction error
  async trainStep(states: number[][], targets: number[][]): Promise<number> {
    const xs = tf.tensor2d(states);
    const ys = tf.tensor2d(targets);
    const history = await this.model.fit(xs, ys, { epochs: 1, batchSize: states.length, verbose: 0 });
    xs.dispose();
    ys.dispose();
    return history.history.loss[0] as number;
  }

  async serialize(): Promise<{ weights: number[][] }> {
    const weights = this.model.getWeights();
    const serialized: number[][] = [];
    for (const w of weights) {
      serialized.push(await w.array() as number[]);
    }
    return { weights: serialized };
  }

  async deserialize(data: { weights: number[][] }): Promise<void> {
    if (!data?.weights?.length) return;
    const tensors = data.weights.map(w => tf.tensor(w));
    this.model.setWeights(tensors);
    tensors.forEach(t => t.dispose());
  }
}

// ─── Inverse Model ──────────────────────────────────────────────
// Predicts action from (enc_s, enc_s_next) — trains the encoder to be informative
export class TFInverseModel {
  model: tf.Sequential;
  enc_dim: number;
  n_actions: number;

  constructor(enc_dim: number, n_actions: number, lr: number = 0.001) {
    this.enc_dim = enc_dim;
    this.n_actions = n_actions;

    this.model = tf.sequential();
    this.model.add(tf.layers.dense({ units: 64, activation: 'relu', inputShape: [2 * enc_dim], kernelInitializer: 'glorotUniform' }));
    this.model.add(tf.layers.dense({ units: n_actions, activation: 'softmax', kernelInitializer: 'glorotUniform' }));
    this.model.compile({ optimizer: tf.train.adam(lr), loss: 'categoricalCrossentropy' });
  }

  forward(enc_s: number[][], enc_s_next: number[][]): number[][] {
    return tf.tidy(() => {
      const batch = enc_s.length;
      const concat = tf.tensor2d(
        Array.from({ length: batch }, (_, i) => [...(enc_s[i] || []), ...(enc_s_next[i] || [])])
      );
      const output = this.model.predict(concat) as tf.Tensor;
      return output.arraySync() as number[][];
    });
  }

  async trainStep(enc_s: number[][], enc_s_next: number[][], actions: number[]): Promise<number> {
    const batch = enc_s.length;
    const xs = tf.tensor2d(
      Array.from({ length: batch }, (_, i) => [...enc_s[i], ...enc_s_next[i]])
    );
    const ys = tf.oneHot(tf.tensor1d(actions, 'int32'), this.n_actions);
    const history = await this.model.fit(xs, ys, { epochs: 1, batchSize: batch, verbose: 0 });
    xs.dispose();
    ys.dispose();
    return history.history.loss[0] as number;
  }

  async serialize(): Promise<{ weights: number[][] }> {
    const weights = this.model.getWeights();
    const serialized: number[][] = [];
    for (const w of weights) {
      serialized.push(await w.array() as number[]);
    }
    return { weights: serialized };
  }

  async deserialize(data: { weights: number[][] }): Promise<void> {
    if (!data?.weights?.length) return;
    const tensors = data.weights.map(w => tf.tensor(w));
    this.model.setWeights(tensors);
    tensors.forEach(t => t.dispose());
  }
}

// ─── Forward Model ─────────────────────────────────────────────
// Predicts next encoding from (enc_s, action) — drives intrinsic curiosity reward
export class TFForwardModel {
  model: tf.Sequential;
  enc_dim: number;
  n_actions: number;

  constructor(enc_dim: number, n_actions: number, lr: number = 0.001) {
    this.enc_dim = enc_dim;
    this.n_actions = n_actions;

    this.model = tf.sequential();
    this.model.add(tf.layers.dense({ units: 64, activation: 'relu', inputShape: [enc_dim + n_actions], kernelInitializer: 'glorotUniform' }));
    this.model.add(tf.layers.dense({ units: enc_dim, activation: 'linear', kernelInitializer: 'glorotUniform' }));
    this.model.compile({ optimizer: tf.train.adam(lr), loss: 'meanSquaredError' });
  }

  forward(enc_s: number[][], a_onehot: number[][]): number[][] {
    return tf.tidy(() => {
      const batch = enc_s.length;
      const concat = tf.tensor2d(
        Array.from({ length: batch }, (_, i) => [...(enc_s[i] || []), ...(a_onehot[i] || [])])
      );
      const output = this.model.predict(concat) as tf.Tensor;
      return output.arraySync() as number[][];
    });
  }

  // Train forward model and return intrinsic rewards (prediction errors)
  async trainStep(enc_s: number[][], a_onehot: number[][], enc_s_next: number[][]): Promise<{ loss: number; intrinsicRewards: number[] }> {
    const batch = enc_s.length;
    const xs = tf.tensor2d(
      Array.from({ length: batch }, (_, i) => [...enc_s[i], ...a_onehot[i]])
    );
    const ys = tf.tensor2d(enc_s_next);
    const history = await this.model.fit(xs, ys, { epochs: 1, batchSize: batch, verbose: 0 });
    xs.dispose();
    ys.dispose();

    // Compute intrinsic rewards: ||prediction - actual||²
    const predictions = this.forward(enc_s, a_onehot);
    const intrinsicRewards = predictions.map((pred, i) => {
      let err = 0;
      for (let j = 0; j < pred.length; j++) {
        const diff = pred[j] - enc_s_next[i][j];
        err += diff * diff;
      }
      return err * 0.1; // scale down
    });

    return { loss: history.history.loss[0] as number, intrinsicRewards };
  }

  // Compute prediction error without training (for curiosity vector)
  getPredictionError(enc_s: number[], a_onehot: number[], enc_s_next: number[]): number {
    const pred = this.forward([enc_s], [a_onehot])[0];
    let err = 0;
    for (let j = 0; j < pred.length; j++) {
      const diff = pred[j] - enc_s_next[j];
      err += diff * diff;
    }
    return err;
  }

  async serialize(): Promise<{ weights: number[][] }> {
    const weights = this.model.getWeights();
    const serialized: number[][] = [];
    for (const w of weights) {
      serialized.push(await w.array() as number[]);
    }
    return { weights: serialized };
  }

  async deserialize(data: { weights: number[][] }): Promise<void> {
    if (!data?.weights?.length) return;
    const tensors = data.weights.map(w => tf.tensor(w));
    this.model.setWeights(tensors);
    tensors.forEach(t => t.dispose());
  }
}
