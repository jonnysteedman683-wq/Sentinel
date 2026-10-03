export function sphericalKMeans(vectors: number[][], k: number, maxIter = 20): number[] {
  if (vectors.length === 0) return [];
  const n = vectors.length;
  const d = vectors[0].length;
  const actualK = Math.min(k, n);
  
  // Normalize vectors
  const normalized = vectors.map(v => {
    let norm = 0;
    for (let i = 0; i < d; i++) norm += v[i] * v[i];
    norm = Math.sqrt(norm) || 1e-9;
    return v.map(x => x / norm);
  });

  // Initialize centroids (randomly choose k distinct data points)
  const centroids: number[][] = [];
  const indices = new Set<number>();
  while (indices.size < actualK) {
    indices.add(Math.floor(Math.random() * n));
  }
  Array.from(indices).forEach(idx => {
    centroids.push([...normalized[idx]]);
  });

  const assignments = new Int32Array(n);
  
  for (let iter = 0; iter < maxIter; iter++) {
    let changed = false;
    
    // Assign to nearest centroid (max dot product)
    for (let i = 0; i < n; i++) {
      let maxDot = -Infinity;
      let bestCluster = 0;
      for (let j = 0; j < actualK; j++) {
        let dot = 0;
        for (let l = 0; l < d; l++) dot += normalized[i][l] * centroids[j][l];
        if (dot > maxDot) {
          maxDot = dot;
          bestCluster = j;
        }
      }
      if (assignments[i] !== bestCluster) {
        assignments[i] = bestCluster;
        changed = true;
      }
    }
    
    if (!changed) break;
    
    // Update centroids
    for (let j = 0; j < actualK; j++) {
      const newCentroid = new Float64Array(d);
      let count = 0;
      for (let i = 0; i < n; i++) {
        if (assignments[i] === j) {
          for (let l = 0; l < d; l++) newCentroid[l] += normalized[i][l];
          count++;
        }
      }
      if (count > 0) {
        let norm = 0;
        for (let l = 0; l < d; l++) norm += newCentroid[l] * newCentroid[l];
        norm = Math.sqrt(norm) || 1e-9;
        for (let l = 0; l < d; l++) centroids[j][l] = newCentroid[l] / norm;
      } else {
        // Handle empty cluster
        const randomIdx = Math.floor(Math.random() * n);
        for (let l = 0; l < d; l++) centroids[j][l] = normalized[randomIdx][l];
      }
    }
  }
  
  return Array.from(assignments);
}
