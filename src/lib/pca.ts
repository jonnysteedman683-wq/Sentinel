export function pca2D(vectors: number[][], maxIter = 40, randomFn = Math.random): [number, number][] {
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
    // Deflation for finding the 2nd principal component
    if (deflate) {
      let proj = 0;
      for (let j = 0; j < d; j++) proj += out[j] * deflate[j];
      for (let j = 0; j < d; j++) out[j] -= proj * deflate[j];
    }
    return out;
  };

  const powerIter = (deflate?: Float64Array) => {
    let v = new Float64Array(d).map(() => randomFn() - 0.5);
    for (let it = 0; it < maxIter; it++) {
      const nv = covMul(v, deflate);
      const norm = Math.sqrt(nv.reduce((s, x) => s + x * x, 0));
      // numerical stability: epsilon floor
      const safeNorm = Math.max(norm, 1e-9);
      for (let i = 0; i < d; i++) {
        v[i] = nv[i] / safeNorm;
      }
    }
    return v;
  };

  const pc1 = powerIter();
  const pc2 = powerIter(pc1);

  // Project centered data onto PC1 and PC2
  return centered.map(row => {
    let x = 0, y = 0;
    for (let j = 0; j < d; j++) { 
      x += row[j] * pc1[j]; 
      y += row[j] * pc2[j]; 
    }
    return [x, y];
  });
}
