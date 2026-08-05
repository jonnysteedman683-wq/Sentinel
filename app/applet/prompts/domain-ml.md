# Domain: Machine Learning & Math

## 1. Web Worker Isolation
- Any compute > ~16ms budget goes to a Worker via Blob URL or module worker. Main thread stays at 60fps.
- Reinforcement Learning agents (e.g. `CuriousAgent`) must execute within web workers to avoid blocking UI rendering.
- State syncing between worker and main thread must be event-driven.

## 2. Numerical Stability
- Guard all ML math: epsilon floors on norms, NaN/Infinity checks after iterative solvers.
- When computing covariance matrices or eigenvalues, always use deterministic seeding options for tests.

## 3. Model Weight Management
- Weights and replay buffers must be serialized efficiently (e.g. Float32Array to base64) before storing in IndexedDB or Firestore.
- Federated learning models (MAML) must securely aggregate updates without passing raw personal tensors when federating to global state.

## <few_shot_examples>
```typescript
// FILE: src/lib/pca.ts — [Extract PCA math for power iteration and dimensionality reduction]
export function pca2D(vectors: number[][], maxIter = 40): [number, number][] {
  if (!vectors || vectors.length === 0) return [];
  const n = vectors.length;
  const d = vectors[0].length;
  if (d === 0) return vectors.map(() => [0, 0]);

  // Center the data
  const mean = new Float64Array(d);
  vectors.forEach(v => {
    for (let j = 0; j < d; j++) mean[j] += v[j] / n;
  });
  
  const centered = vectors.map(v => v.map((x, j) => x - mean[j]));
  
  // Power iteration with implicit covariance
  const covMul = (vec: Float64Array, deflate?: Float64Array) => {
    const out = new Float64Array(d);
    for (const row of centered) {
      let dot = 0;
      for (let j = 0; j < d; j++) dot += row[j] * vec[j];
      for (let j = 0; j < d; j++) out[j] += dot * row[j] / n;
    }
    if (deflate) {
      let proj = 0;
      for (let j = 0; j < d; j++) proj += out[j] * deflate[j];
      for (let j = 0; j < d; j++) out[j] -= proj * deflate[j];
    }
    return out;
  };

  const powerIter = (deflate?: Float64Array) => {
    let v = new Float64Array(d).map(() => Math.random() - 0.5);
    for (let it = 0; it < maxIter; it++) {
      const nv = covMul(v, deflate);
      const norm = Math.sqrt(nv.reduce((s, x) => s + x * x, 0));
      const safeNorm = Math.max(norm, 1e-9);
      for (let i = 0; i < d; i++) {
        v[i] = nv[i] / safeNorm;
      }
    }
    return v;
  };

  const pc1 = powerIter();
  const pc2 = powerIter(pc1);

  return centered.map(row => {
    let x = 0, y = 0;
    for (let j = 0; j < d; j++) { 
      x += row[j] * pc1[j]; 
      y += row[j] * pc2[j]; 
    }
    return [x, y];
  });
}
```
