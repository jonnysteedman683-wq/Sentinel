# AQB System Directives

## 1. Stability Mandate
- **Zero-Regression Policy:** The current architecture (comprising the QPU-ERD integrations, MAML/RML modules, and cognitive agents) is in a profound, stable state. Do not jeopardize this.
- **Surgical Edits Only:** Do not perform large-scale refactors of `App.tsx` or `server.ts`. All modifications must be strictly additive, isolated, and non-destructive.

## 2. Knowledge Graph & ERD Architecture
- The `/api/knowledge/erd` endpoint is precisely tuned for biomedical, gene function, disease pathway, and quantum meta-learning contexts.
- Prompting instructions emphasize: precise object recognition, highly specific concepts, and extraction via action-oriented verbs. Do not alter these prompts without explicit user consent.

## 3. Future-Proofing Guidelines
- Prioritize strict TypeScript interfaces for any new data structures.
- Ensure all API endpoints implement graceful degradation to prevent cascading failures.
- Keep new components modularized to prevent further monolithic bloat in core files.

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
    // Deflation for finding the 2nd principal component
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
```

## 4. Manifest Protocol
- **Machine-Readable Manifest:** Whenever generating or updating files, you MUST emit a JSON manifest alongside your code block artifacts. 
- The manifest must be enclosed in a \`\`\`json\`\`\` block and include the files created/modified, their exported interfaces/functions, and any external dependencies. This ensures programmatic diffing and validation (HELIX artifact protocol).
- Manifest Schema Example:
  ```json
  {
    "delivery": {
      "files": [
        {
          "path": "src/lib/example.ts",
          "action": "create",
          "exports": ["ExampleFunction", "ExampleInterface"]
        }
      ],
      "dependencies_added": ["lucide-react"]
    }
  }
  ```

## 5. Test Contract
- **Vitest Spec Requirement:** Mandate a Vitest spec file per ML module with fixed-seed numerical assertions. This turns the quality gate from a self-check into enforceable output.
