import { describe, it, expect } from 'vitest';
import { FederatedServer } from './federation.js';

describe('FederatedServer FedAvg', () => {
  it('should compute weighted average of model weights correctly', async () => {
    const updates = [
      { weights: [[1.0, 2.0], [3.0, 4.0]], sampleSize: 10 },
      { weights: [[3.0, 4.0], [5.0, 6.0]], sampleSize: 30 }
    ];
    // Total samples = 40
    // Weight 1: 1.0 * (10/40) + 3.0 * (30/40) = 0.25 + 2.25 = 2.5
    // Weight 2: 2.0 * (10/40) + 4.0 * (30/40) = 0.5 + 3.0 = 3.5
    // Weight 3: 3.0 * (10/40) + 5.0 * (30/40) = 0.75 + 3.75 = 4.5
    // Weight 4: 4.0 * (10/40) + 6.0 * (30/40) = 1.0 + 4.5 = 5.5
    const result = await FederatedServer.aggregate(updates);
    
    expect(result[0][0]).toBeCloseTo(2.5, 5);
    expect(result[0][1]).toBeCloseTo(3.5, 5);
    expect(result[1][0]).toBeCloseTo(4.5, 5);
    expect(result[1][1]).toBeCloseTo(5.5, 5);
  });
  
  it('should return empty array when no updates are provided', async () => {
    const result = await FederatedServer.aggregate([]);
    expect(result).toEqual([]);
  });
});
