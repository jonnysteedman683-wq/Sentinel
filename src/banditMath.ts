// banditMath.ts — Pure math for multi-armed bandit strategies.
// Thompson Sampling (Beta-Bernoulli) with reward decay, plus UCB1 fallback.
// No Dexie, no React — fully unit-testable in isolation.

export interface ArmState {
  alpha: number;   // successes + 1 (Beta prior)
  beta: number;    // failures + 1 (Beta prior)
  pulls: number;   // total selections
}

export interface ScoredArm<T = string> {
  key: T;
  score: number;
  expectedValue: number;
  arm: ArmState;
}

export const DEFAULT_DECAY = 0.98;   // per-update multiplier on alpha/beta
export const MIN_PSEUDO_COUNT = 1;   // never decay below uniform prior

export function freshArm(): ArmState {
  return { alpha: 1, beta: 1, pulls: 0 };
}

// ---------------------------------------------------------------------------
// Gamma sampling via Marsaglia-Tsang (2000). Needed for Beta sampling.
// ---------------------------------------------------------------------------
function sampleGamma(shape: number, rng: () => number = Math.random): number {
  if (shape < 1) {
    // Boost shape and correct: Gamma(a) = Gamma(a+1) * U^(1/a)
    const u = rng();
    return sampleGamma(shape + 1, rng) * Math.pow(u, 1 / shape);
  }
  const d = shape - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);
  // Rejection loop — expected iterations ≈ 1.05
  for (let i = 0; i < 100; i++) {
    let x: number, v: number;
    do {
      x = gaussian(rng);
      v = 1 + c * x;
    } while (v <= 0);
    v = v * v * v;
    const u = rng();
    if (u < 1 - 0.0331 * x * x * x * x) return d * v;
    if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
  }
  return d; // pathological RNG fallback: return mode
}

// Box-Muller standard normal
function gaussian(rng: () => number): number {
  let u = 0, v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** Draw one sample from Beta(alpha, beta). */
export function sampleBeta(alpha: number, beta: number, rng?: () => number): number {
  const x = sampleGamma(alpha, rng);
  const y = sampleGamma(beta, rng);
  return x / (x + y);
}

// ---------------------------------------------------------------------------
// Strategies
// ---------------------------------------------------------------------------

/** Thompson Sampling: sample each arm's posterior, pick the max. */
export function thompsonSelect<T>(
  arms: Map<T, ArmState>,
  rng?: () => number,
): ScoredArm<T>[] {
  const scored: ScoredArm<T>[] = [];
  for (const [key, arm] of arms) {
    scored.push({
      key,
      score: sampleBeta(arm.alpha, arm.beta, rng),
      expectedValue: expectedValue(arm),
      arm,
    });
  }
  return scored.sort((a, b) => b.score - a.score);
}

/** UCB1: deterministic optimism-under-uncertainty. Good for debugging/replay. */
export function ucb1Select<T>(arms: Map<T, ArmState>): ScoredArm<T>[] {
  const totalPulls = [...arms.values()].reduce((s, a) => s + a.pulls, 0) || 1;
  const scored: ScoredArm<T>[] = [];
  for (const [key, arm] of arms) {
    const mean = expectedValue(arm);
    const bonus = arm.pulls === 0
      ? Number.POSITIVE_INFINITY // force exploration of untried arms
      : Math.sqrt((2 * Math.log(totalPulls)) / arm.pulls);
    scored.push({ key, score: mean + bonus, expectedValue: mean, arm });
  }
  return scored.sort((a, b) => b.score - a.score);
}

// ---------------------------------------------------------------------------
// Updates
// ---------------------------------------------------------------------------

/**
 * Apply a reward in [0, 1] with decay-before-update.
 * Decay makes the bandit non-stationary-aware: old evidence fades,
 * so agents that improve (or regress) are re-ranked quickly.
 */
export function updateArm(
  arm: ArmState,
  reward: number,
  decay: number = DEFAULT_DECAY,
): ArmState {
  const r = clamp01(reward);
  const alpha = Math.max(MIN_PSEUDO_COUNT, arm.alpha * decay) + r;
  const beta = Math.max(MIN_PSEUDO_COUNT, arm.beta * decay) + (1 - r);
  return { alpha, beta, pulls: arm.pulls + 1 };
}

// ---------------------------------------------------------------------------
// Diagnostics (for BanditPanel viz later)
// ---------------------------------------------------------------------------

export function expectedValue(arm: ArmState): number {
  return arm.alpha / (arm.alpha + arm.beta);
}

/** Approximate 95% credible interval via Beta variance (normal approx). */
export function credibleInterval95(arm: ArmState): [number, number] {
  const { alpha: a, beta: b } = arm;
  const mean = a / (a + b);
  const variance = (a * b) / ((a + b) ** 2 * (a + b + 1));
  const half = 1.96 * Math.sqrt(variance);
  return [clamp01(mean - half), clamp01(mean + half)];
}

function clamp01(x: number): number {
  return Math.min(1, Math.max(0, x));
}
