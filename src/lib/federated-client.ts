import * as tf from '@tensorflow/tfjs';

export interface FederatedConfig {
  epsilon: number;
  delta: number;
  sensitivity: number; // L2 sensitivity for clipping
}

export class FederatedClient {
  private config: FederatedConfig;

  constructor(config: FederatedConfig = { epsilon: 8, delta: 1e-5, sensitivity: 1.0 }) {
    this.config = config;
  }

  /**
   * Adds Gaussian noise to weights for Differential Privacy
   */
  public addDPNoise(weights: tf.Tensor[]): tf.Tensor[] {
    const { epsilon, delta, sensitivity } = this.config;
    // Standard deviation for Gaussian mechanism
    const std = (sensitivity * Math.sqrt(2 * Math.log(1.25 / delta))) / epsilon;

    return weights.map(w => {
      return tf.tidy(() => {
        // Clip weights first to ensure sensitivity bound
        const clipped = tf.clipByValue(w, -sensitivity, sensitivity);
        const noise = tf.randomNormal(w.shape, 0, std);
        return clipped.add(noise);
      });
    });
  }

  /**
   * Computes the difference (delta) between local and global weights
   */
  public computeDelta(localWeights: tf.Tensor[], globalWeights: tf.Tensor[]): tf.Tensor[] {
    return localWeights.map((lw, i) => lw.sub(globalWeights[i]));
  }

  /**
   * Converts serializable weights (arrays) to Tensors
   */
  public async arrayToTensors(weightArrays: any[]): Promise<tf.Tensor[]> {
    return weightArrays.map(arr => tf.tensor(arr));
  }

  /**
   * Converts Tensors to serializable arrays
   */
  public async tensorsToArrays(tensors: tf.Tensor[]): Promise<any[]> {
    return Promise.all(tensors.map(t => t.array()));
  }

  /**
   * Generates a dream fragment from world model state
   */
  public async generateDreamFragment(state: number[], persona: string): Promise<{ text: string; embedding: number[] }> {
    // In a real app, this would use Gemini to turn the state vector into a poetic fragment
    // For now, we simulate a fragment based on the state's dominant features
    const fragment = `Agent ${persona} envisions a state of ${state[0] > 0.5 ? 'high coherence' : 'chaotic potential'} with ${state[1] > 0.5 ? 'surging novelty' : 'stable foundations'}.`;
    
    // Generate a pseudo-embedding (mean-centered)
    const embedding = state.map(s => s - 0.5);
    
    return { text: fragment, embedding };
  }
}
