// Helper for SIMD dot product of two arrays
export function simdDot(aRaw: usize, bRaw: usize, len: i32): f32 {
  let sum = v128.splat<f32>(0.0);
  let i = 0;
  
  // Process 4 floats (16 bytes) at a time
  while (i + 4 <= len) {
    let va = v128.load(aRaw + (<usize>i << 2));
    let vb = v128.load(bRaw + (<usize>i << 2));
    sum = f32x4.add(sum, f32x4.mul(va, vb));
    i += 4;
  }
  
  // Horizontal sum
  let sum0 = f32x4.extract_lane(sum, 0);
  let sum1 = f32x4.extract_lane(sum, 1);
  let sum2 = f32x4.extract_lane(sum, 2);
  let sum3 = f32x4.extract_lane(sum, 3);
  
  let total: f32 = sum0 + sum1 + sum2 + sum3;
  
  // Process remaining elements
  while (i < len) {
    let va = load<f32>(aRaw + (<usize>i << 2));
    let vb = load<f32>(bRaw + (<usize>i << 2));
    total += va * vb;
    i++;
  }
  
  return total;
}

// Compute Euclidean norm
export function simdNorm(aRaw: usize, len: i32): f32 {
  return Math.sqrt(simdDot(aRaw, aRaw, len)) as f32;
}

// Cosine Similarity
export function simdCosineSim(aRaw: usize, bRaw: usize, len: i32): f32 {
  let dot = simdDot(aRaw, bRaw, len);
  let normA = simdNorm(aRaw, len);
  let normB = simdNorm(bRaw, len);
  let denom = normA * normB;
  if (denom == 0.0) return 0.0;
  return dot / denom;
}
