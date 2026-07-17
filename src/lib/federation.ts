import * as tf from '@tensorflow/tfjs';

export class FederatedServer {
  /**
   * FedAvg: Weighted average of model weight updates
   */
  public static async aggregate(updates: { weights: any[], sampleSize: number }[]): Promise<any[]> {
    if (updates.length === 0) return [];

    const totalSamples = updates.reduce((acc, u) => acc + u.sampleSize, 0);
    
    // Convert first update to tensors as baseline
    const aggregatedTensors: tf.Tensor[] = updates[0].weights.map((w) => {
      return tf.tidy(() => {
        const weightTensor = tf.tensor(w);
        return weightTensor.mul(updates[0].sampleSize / totalSamples);
      });
    });

    // Add remaining updates
    for (let i = 1; i < updates.length; i++) {
      const scale = updates[i].sampleSize / totalSamples;
      updates[i].weights.forEach((w, j) => {
        const current = aggregatedTensors[j];
        const nextTensor = tf.tidy(() => {
          const weightTensor = tf.tensor(w);
          const scaled = weightTensor.mul(scale);
          return current.add(scaled);
        });
        aggregatedTensors[j] = nextTensor;
        current.dispose(); // Cleanup
      });
    }

    const result = await Promise.all(aggregatedTensors.map(t => t.array()));
    aggregatedTensors.forEach(t => t.dispose());
    return result;
  }
}
