// ═══ THOMPSON SAMPLING AGENT ROUTER — all-in-one ═══
import { useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { motion } from 'motion/react';
import { Brain, Compass, Target } from 'lucide-react';
import { db } from './db';
import BanditDistributionsChart from './BanditDistributionsChart';

// ── Types ──
export type TaskType = 'forge_codegen' | 'forge_repair' | 'weaver_synthesis' | 'prompt_refine' | 'skill_distill' | 'general';
export interface BanditArm { id?: number; agentId: string; taskType: TaskType; alpha: number; beta: number; pulls: number; lastReward: number; updatedAt: number; }
export interface BanditDecision { agentId: string; taskType: TaskType; sampledValue: number; expectedValue: number; explorationFlag: boolean; timestamp: number; }

export const forgeReward = (ok: boolean, retries: number) => ok ? Math.max(0.25, 1 - retries * 0.25) : 0;

import { sampleBeta } from './banditMath';

// ── Engine ──
export async function selectAgent(agentIds: string[], taskType: TaskType): Promise<BanditDecision> {
  if (!agentIds.length) throw new Error('no eligible agents');
  const existing = await db.banditArms.where('taskType').equals(taskType).toArray();
  const known = new Set(existing.map((a: BanditArm) => a.agentId));
  const now = Date.now();
  const missing: BanditArm[] = agentIds.filter(id => !known.has(id))
    .map(agentId => ({ agentId, taskType, alpha: 1, beta: 1, pulls: 0, lastReward: 0, updatedAt: now }));
  if (missing.length) await db.banditArms.bulkAdd(missing);
  const arms = [...existing.filter((a: BanditArm) => agentIds.includes(a.agentId)), ...missing];

  let winner = arms[0], best = -1, bestMean = -1, bestMeanAgent = '';
  for (const arm of arms) {
    const s = sampleBeta(arm.alpha, arm.beta), m = arm.alpha / (arm.alpha + arm.beta);
    if (m > bestMean) { bestMean = m; bestMeanAgent = arm.agentId; }
    if (s > best) { best = s; winner = arm; }
  }
  const decision: BanditDecision = {
    agentId: winner.agentId, taskType, sampledValue: best,
    expectedValue: winner.alpha / (winner.alpha + winner.beta),
    explorationFlag: winner.agentId !== bestMeanAgent, timestamp: now,
  };
  await db.banditDecisions.add(decision);
  return decision;
}

export async function reportReward(agentId: string, taskType: TaskType, reward: number): Promise<void> {
  const arm = await db.banditArms.where('[agentId+taskType]').equals([agentId, taskType]).first();
  if (!arm) return;
  const r = Math.min(1, Math.max(0, reward));
  await db.banditArms.update(arm.id!, {
    alpha: arm.alpha + r, beta: arm.beta + (1 - r),
    pulls: arm.pulls + 1, lastReward: r, updatedAt: Date.now(),
  });
}

export async function decayArms(factor = 0.99): Promise<void> {
  const arms = await db.banditArms.toArray();
  for (const a of arms) await db.banditArms.update(a.id!, {
    alpha: Math.max(1, a.alpha * factor), beta: Math.max(1, a.beta * factor),
  });
}

// ── Hook ──
export function useBandit(taskType: TaskType) {
  const route = useCallback(async () => {
    const agents = await db.agents.where('status').equals('active').toArray();
    if (!agents) return;
    return selectAgent(agents.map((a: any) => a.id), taskType);
  }, [taskType]);
  const report = useCallback(
    (agentId: string, reward: number) => reportReward(agentId, taskType, reward),
    [taskType]
  );
  return { route, report };
}

// ── Panel ──
function ArmBar({ arm, name }: { arm: BanditArm; name: string }) {
  const mean = arm.alpha / (arm.alpha + arm.beta);
  const v = (arm.alpha * arm.beta) / ((arm.alpha + arm.beta) ** 2 * (arm.alpha + arm.beta + 1));
  const ci = 1.96 * Math.sqrt(v);
  return (
    <div className="border border-slate-800 bg-slate-900/60 rounded-lg p-3 backdrop-blur">
      <div className="flex justify-between items-center mb-2">
        <span className="font-mono text-xs text-slate-300 uppercase tracking-widest">{name}</span>
        <span className="font-mono text-[10px] text-amber-400">{(mean * 100).toFixed(1)}% ±{(ci * 100).toFixed(0)}</span>
      </div>
      <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden relative">
        <div className="absolute h-full bg-amber-500/20" style={{ left: `${Math.max(0, mean - ci) * 100}%`, width: `${Math.min(1, ci * 2) * 100}%` }} />
        <motion.div className="h-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)]"
          initial={{ width: 0 }} animate={{ width: `${mean * 100}%` }} transition={{ duration: 0.6, ease: 'easeOut' }} />
      </div>
      <div className="flex gap-3 mt-2 font-mono text-[10px] text-slate-500">
        <span>PULLS {arm.pulls}</span><span>α {arm.alpha.toFixed(1)}</span><span>β {arm.beta.toFixed(1)}</span>
      </div>
    </div>
  );
}

export default function BanditPanel() {
  const arms = useLiveQuery(() => db.banditArms.toArray());
  const decisions = useLiveQuery(() => db.banditDecisions.reverse().limit(10).toArray());
  const agents = useLiveQuery(() => db.agents.toArray());
  const nameOf = (id: string) => agents?.find((a: any) => a.id === id)?.name ?? id.slice(0, 8);
  const byTask = (arms ?? []).reduce<Record<string, BanditArm[]>>((acc, a: BanditArm) => { (acc[a.taskType] ??= []).push(a); return acc; }, {});

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-2">
        <Brain className="w-4 h-4 text-amber-400" />
        <h2 className="font-mono text-sm uppercase tracking-widest text-slate-200">Routing Cortex</h2>
        <span className="font-mono text-[10px] text-slate-500 ml-2">THOMPSON SAMPLING · LIVE POSTERIORS</span>
      </div>
      {Object.entries(byTask).map(([task, taskArms]) => (
        <div key={task}>
          <div className="flex items-center gap-2 mb-2">
            <Target className="w-3 h-3 text-slate-500" />
            <span className="font-mono text-[10px] uppercase tracking-widest text-slate-400">{task}</span>
          </div>
          <div className="mb-4 bg-slate-900/40 rounded-xl p-4 border border-slate-800">
            <BanditDistributionsChart arms={taskArms.map(a => ({...a, agentId: nameOf(a.agentId)}))} height={240} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {taskArms.sort((a, b) => b.alpha / (b.alpha + b.beta) - a.alpha / (a.alpha + a.beta))
              .map(arm => <ArmBar key={arm.id!} arm={arm} name={nameOf(arm.agentId)} />)}
          </div>
        </div>
      ))}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Compass className="w-3 h-3 text-slate-500" />
          <span className="font-mono text-[10px] uppercase tracking-widest text-slate-400">Decision Log</span>
        </div>
        <div className="space-y-1">
          {(decisions ?? []).map((d: BanditDecision, i: number) => (
            <div key={i} className="flex gap-3 font-mono text-[10px] text-slate-500">
              <span className="text-slate-600">{new Date(d.timestamp).toLocaleTimeString()}</span>
              <span className="text-slate-300">{nameOf(d.agentId)}</span>
              <span>{d.taskType}</span>
              <span className="text-amber-400/70">s={d.sampledValue.toFixed(3)}</span>
              {d.explorationFlag && <span className="text-cyan-400">EXPLORE</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
