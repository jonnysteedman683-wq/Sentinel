export function sphericalKMeans(vectors: number[][], k: number, maxIter = 20, randomFn = Math.random): number[] {
  if (vectors.length === 0) return [];
  const n = vectors.length;
  const d = vectors[0].length;
  
  // Normalize vectors
  const normalized = vectors.map(v => {
    let norm = 0;
    for (let i = 0; i < d; i++) norm += v[i] * v[i];
    norm = Math.sqrt(norm) || 1e-9;
    return v.map(x => x / norm);
  });

  // K-Means++ Initialization
  const centroids: number[][] = [];
  centroids.push([...normalized[Math.floor(randomFn() * n)]]);

  while (centroids.length < Math.min(k, n)) {
    const distances = new Float64Array(n);
    let totalDist = 0;
    for (let i = 0; i < n; i++) {
      let minDist = Infinity;
      for (let j = 0; j < centroids.length; j++) {
        let dot = 0;
        for (let l = 0; l < d; l++) dot += normalized[i][l] * centroids[j][l];
        // Spherical distance roughly proportional to 1 - dot
        const dist = 1 - dot;
        if (dist < minDist) minDist = dist;
      }
      const squaredDist = minDist * minDist;
      distances[i] = squaredDist;
      totalDist += squaredDist;
    }

    let r = randomFn() * totalDist;
    let selectedIdx = n - 1;
    for (let i = 0; i < n; i++) {
      r -= distances[i];
      if (r <= 0) {
        selectedIdx = i;
        break;
      }
    }
    centroids.push([...normalized[selectedIdx]]);
  }

  const assignments = new Int32Array(n);
  
  for (let iter = 0; iter < maxIter; iter++) {
    let changed = false;
    
    // Assign to nearest centroid (max dot product)
    for (let i = 0; i < n; i++) {
      let maxDot = -Infinity;
      let bestCluster = 0;
      for (let j = 0; j < centroids.length; j++) {
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
    for (let j = 0; j < centroids.length; j++) {
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
        const randomIdx = Math.floor(randomFn() * n);
        for (let l = 0; l < d; l++) centroids[j][l] = normalized[randomIdx][l];
      }
    }
  }
  
  return Array.from(assignments);
}
