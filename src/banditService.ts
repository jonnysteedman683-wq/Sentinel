// banditService.ts — Persistence + orchestration layer for the agent bandit.
// Reads/writes the v5 stores: banditArms, banditDecisions.
// All math delegated to banditMath.ts.

import { db } from './db';
import {
  ArmState,
  ScoredArm,
  freshArm,
  thompsonSelect,
  ucb1Select,
  updateArm,
  expectedValue,
  credibleInterval95,
  DEFAULT_DECAY,
} from './banditMath';

export type BanditStrategy = 'thompson' | 'ucb1';

export interface BanditArmRow {
  id?: number;
  agentId: string;
  taskType: string;
  alpha: number;
  beta: number;
  pulls: number;
  updatedAt: number;
}

export interface BanditDecisionRow {
  id?: number;
  agentId: string;
  taskType: string;
  strategy: BanditStrategy;
  score: number;            // sampled/UCB score at selection time
  expectedValue: number;    // posterior mean at selection time
  reward?: number;          // filled in by recordOutcome
  resolvedAt?: number;
  timestamp: number;
}

export interface SelectionResult {
  agentId: string;
  decisionId: number;       // pass back to recordOutcome()
  score: number;
  expectedValue: number;
  ranking: ScoredArm<string>[]; // full ranked list, for UI transparency
}

// ---------------------------------------------------------------------------
// Arm access
// ---------------------------------------------------------------------------

async function loadArms(
  taskType: string,
  agentIds: string[],
): Promise<Map<string, { row: BanditArmRow; state: ArmState }>> {
  const rows = (await db.banditArms
    .where('taskType')
    .equals(taskType)
    .toArray()) as BanditArmRow[];

  const byAgent = new Map(rows.map((r) => [r.agentId, r]));
  const result = new Map<string, { row: BanditArmRow; state: ArmState }>();

  for (const agentId of agentIds) {
    const existing = byAgent.get(agentId);
    if (existing) {
      result.set(agentId, {
        row: existing,
        state: { alpha: existing.alpha, beta: existing.beta, pulls: existing.pulls },
      });
    } else {
      const state = freshArm();
      const row: BanditArmRow = {
        agentId,
        taskType,
        ...state,
        updatedAt: Date.now(),
      };
      row.id = (await db.banditArms.add(row)) as number;
      result.set(agentId, { row, state });
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Pick the best agent for a task type. Logs the decision and returns
 * a decisionId — call recordOutcome(decisionId, reward) when the task resolves.
 */
export async function selectAgent(
  taskType: string,
  candidateAgentIds: string[],
  strategy: BanditStrategy = 'thompson',
): Promise<SelectionResult> {
  if (candidateAgentIds.length === 0) {
    throw new Error(`selectAgent: no candidates for taskType "${taskType}"`);
  }

  const arms = await loadArms(taskType, candidateAgentIds);
  const stateMap = new Map(
    [...arms.entries()].map(([id, { state }]) => [id, state]),
  );

  const ranking =
    strategy === 'thompson' ? thompsonSelect(stateMap) : ucb1Select(stateMap);
  const winner = ranking[0];

  const decision: BanditDecisionRow = {
    agentId: winner.key,
    taskType,
    strategy,
    score: winner.score,
    expectedValue: winner.expectedValue,
    timestamp: Date.now(),
  };
  const decisionId = (await db.banditDecisions.add(decision)) as number;

  return {
    agentId: winner.key,
    decisionId,
    score: winner.score,
    expectedValue: winner.expectedValue,
    ranking,
  };
}

/**
 * Resolve a decision with a reward in [0, 1].
 * Reward heuristics: 1 = clean success, 0 = failure.
 * Forge integration: e.g. 1 - (repairAttempts / maxRepairs) gives partial
 * credit to agents whose code needed fewer self-repair cycles.
 */
export async function recordOutcome(
  decisionId: number,
  reward: number,
  decay: number = DEFAULT_DECAY,
): Promise<void> {
  const decision = (await db.banditDecisions.get(decisionId)) as
    | BanditDecisionRow
    | undefined;
  if (!decision) throw new Error(`recordOutcome: decision ${decisionId} not found`);
  if (decision.reward !== undefined) return; // idempotent — already resolved

  await db.transaction('rw', db.banditArms, db.banditDecisions, async () => {
    const row = (await db.banditArms
      .where('[agentId+taskType]')
      .equals([decision.agentId, decision.taskType])
      .first()) as BanditArmRow | undefined;
    if (!row) return;

    const next = updateArm(
      { alpha: row.alpha, beta: row.beta, pulls: row.pulls },
      reward,
      decay,
    );

    await db.banditArms.update(row.id!, { ...next, updatedAt: Date.now() });
    await db.banditDecisions.update(decisionId, {
      reward,
      resolvedAt: Date.now(),
    });
  });
}

/** Stats for a task type — feed directly into a BanditPanel / recharts viz. */
export async function getArmStats(taskType: string) {
  const rows = (await db.banditArms
    .where('taskType')
    .equals(taskType)
    .toArray()) as BanditArmRow[];

  return rows
    .map((r) => {
      const state: ArmState = { alpha: r.alpha, beta: r.beta, pulls: r.pulls };
      return {
        agentId: r.agentId,
        pulls: r.pulls,
        expectedValue: expectedValue(state),
        credibleInterval: credibleInterval95(state),
        updatedAt: r.updatedAt,
      };
    })
    .sort((a, b) => b.expectedValue - a.expectedValue);
}

/** Recent decision history — for the learning-curve chart. */
export async function getDecisionHistory(taskType: string, limit = 200) {
  return (await db.banditDecisions
    .where('taskType')
    .equals(taskType)
    .reverse()
    .limit(limit)
    .toArray()) as BanditDecisionRow[];
}

/** Wipe learning for a task type (e.g. after a major agent prompt rewrite). */
export async function resetTaskType(taskType: string): Promise<void> {
  await db.transaction('rw', db.banditArms, db.banditDecisions, async () => {
    await db.banditArms.where('taskType').equals(taskType).delete();
    await db.banditDecisions.where('taskType').equals(taskType).delete();
  });
}
