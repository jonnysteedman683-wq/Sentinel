import { doc, getDoc, setDoc, db } from '../firebase.js';
import * as tf from '@tensorflow/tfjs';

export interface Preferences {
  mu: number[];
  sigmaDiag: number[];
  updatedAt: number;
}

export const DEFAULT_PREFERENCES: Preferences = {
  // state: [memoryCount, sentiment, activity, depth, ...]
  // We prefer: moderate memories, high sentiment, moderate activity, deep focus
  mu: [0.5, 0.8, 0.6, 0.7], 
  sigmaDiag: [0.2, 0.1, 0.2, 0.1],
  updatedAt: Date.now()
};

export class PreferenceManager {
  private userId: string;
  private current: Preferences = DEFAULT_PREFERENCES;

  constructor(userId: string) {
    this.userId = userId;
  }

  async load() {
    try {
      const snap = await getDoc(doc(db, 'users', this.userId, 'rlAgent', 'preferences'));
      if (snap.exists()) {
        this.current = snap.data() as Preferences;
      }
    } catch (e) {
      console.error('Failed to load preferences:', e);
    }
  }

  async save() {
    try {
      await setDoc(doc(db, 'users', this.userId, 'rlAgent', 'preferences'), this.current);
    } catch (e) {
      console.error('Failed to save preferences:', e);
    }
  }

  get mu(): tf.Tensor1D {
    return tf.tensor1d(this.current.mu);
  }

  get invCov(): tf.Tensor2D {
    // Sigma is diagonal, so inverse is 1/sigma
    const invDiag = this.current.sigmaDiag.map(s => 1 / (s + 1e-6));
    return tf.diag(tf.tensor1d(invDiag)) as tf.Tensor2D;
  }

  get invCovDiag(): tf.Tensor1D {
    const invDiag = this.current.sigmaDiag.map(s => 1 / (s + 1e-6));
    return tf.tensor1d(invDiag);
  }

  update(observedState: number[], lr: number = 0.01) {
    this.current.mu = this.current.mu.map((val, i) => val * (1 - lr) + observedState[i] * lr);
    this.current.updatedAt = Date.now();
  }

  getRaw(): Preferences {
    return this.current;
  }
}
