# ML MATH INJECTION

## DOMAIN: CLIENT-SIDE ML
1. Numerical stability first. Guard all ML math: epsilon floors on norms, NaN/Infinity checks.
2. Web Worker isolation. Any compute > ~16ms budget goes to a Worker via module worker. Main thread stays at 60fps.
3. Deterministic ML pipelines: every transform (normalize -> project -> cluster -> layout) is a pure function.
4. Support seeded randomization for deterministic testing via Vitest.
