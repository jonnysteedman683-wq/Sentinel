import { describe, it, expect } from 'vitest';
import * as tf from '@tensorflow/tfjs';
import { WorldModel } from './world-model.js';

describe('WorldModel VRSSM', () => {
  it('should initialize without crashing', () => {
    const model = new WorldModel(4, 2, 8, 4);
    expect(model).toBeDefined();
  });

  it('should run a forward pass and return correct shapes', () => {
    const model = new WorldModel(4, 2, 8, 4);
    
    tf.tidy(() => {
      const state = tf.tensor2d([[0.1, 0.2, 0.3, 0.4]]);
      const action = tf.tensor2d([[1.0, 0.0]]);
      
      const preds = model.predictStep(state, action);
      
      expect(preds.nextStateMean.shape).toEqual([1, 4]);
      expect(preds.nextStateLogVar.shape).toEqual([1, 4]);
      expect(preds.latentMean.shape).toEqual([1, 8]);
      expect(preds.reward.shape).toEqual([1, 1]);
    });
  });
});
