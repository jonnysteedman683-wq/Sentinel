import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line, Legend
} from 'recharts';
import { Cpu, Play, Loader2, ChevronDown, ChevronUp, AlertTriangle, Zap, Target, Activity } from 'lucide-react';
import { auth } from '../firebase.js';

// Matches AgentAction enum in rl-agent.ts
const AGENT_ACTIONS = [
  { index: 0, label: 'Idle',             color: '#6b7280', icon: '💤' },
  { index: 1, label: 'Change Depth',     color: '#3b82f6', icon: '🔭' },
  { index: 2, label: 'Consolidate',      color: '#8b5cf6', icon: '🧬' },
  { index: 3, label: 'Nudge',            color: '#10b981', icon: '🌱' },
  { index: 4, label: 'Consolidate Chats',color: '#f59e0b', icon: '💬' },
  { index: 5, label: 'Insight',          color: '#ec4899', icon: '✨' },
  { index: 6, label: 'Hybrid Sync RAG',  color: '#22d3ee', icon: '⚛️' },
];

interface RolloutStep {
  step: number;
  state: number[];
  reward: number;
  done: boolean;
  uncertainty: number;
}

interface RolloutResult {
  success: boolean;
  steps: RolloutStep[];
  cumulativeReward: number;
  horizon: number;
  error?: string;
}

interface Props {
  initialState?: number[];
}

const STATE_DIM_LABELS = ['Memory Density', 'Q-Convergence', 'Sentiment Drift', 'Arousal'];

export function PredictiveRolloutPanel({ initialState }: Props) {
  const [horizon, setHorizon] = useState(10);
  const [selectedAction, setSelectedAction] = useState(2); // default: Consolidate
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RolloutResult | null>(null);
  const [modelStatus, setModelStatus] = useState<{ exists: boolean; updatedAt?: number } | null>(null);
  const [expandedStep, setExpandedStep] = useState<number | null>(null);
  const [statusChecked, setStatusChecked] = useState(false);

  const checkStatus = useCallback(async () => {
    if (statusChecked) return;
    try {
      const token = auth.currentUser ? await auth.currentUser.getIdToken() : '';
      const res = await fetch('/api/world-model/status', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setModelStatus(data);
      setStatusChecked(true);
    } catch (e) {
      setModelStatus({ exists: false });
    }
  }, [statusChecked]);

  const runRollout = async () => {
    setLoading(true);
    setResult(null);
    try {
      const token = auth.currentUser ? await auth.currentUser.getIdToken() : '';
      const state = initialState ?? new Array(4).fill(0).map((_, i) => Math.random() * (i === 1 ? 1 : 0.5));
      const res = await fetch('/api/world-model/rollout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ state, horizon, actionSequence: new Array(horizon).fill(selectedAction) })
      });
      const data: RolloutResult = await res.json();
      setResult(data);
    } catch (e: any) {
      setResult({ success: false, steps: [], cumulativeReward: 0, horizon: 0, error: e.message });
    } finally {
      setLoading(false);
    }
  };

  // Build chart data
  const chartData = result?.steps.map((s, i) => ({
    step: `T+${s.step}`,
    reward: parseFloat(s.reward.toFixed(4)),
    uncertainty: parseFloat(s.uncertainty.toFixed(4)),
    upperBound: parseFloat((s.reward + s.uncertainty).toFixed(4)),
    lowerBound: parseFloat((s.reward - s.uncertainty).toFixed(4)),
    donePct: parseFloat((s.done ? 1 : 0).toFixed(2)),
    cumReward: parseFloat(
      result.steps.slice(0, i + 1).reduce((sum, x) => sum + x.reward, 0).toFixed(4)
    )
  })) ?? [];

  const actionInfo = AGENT_ACTIONS[selectedAction];
  const hasModel = modelStatus?.exists;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      onViewportEnter={checkStatus}
      className="relative rounded-2xl border border-violet-500/20 bg-gradient-to-br from-gray-950/80 via-violet-950/20 to-gray-950/80 backdrop-blur-xl p-5 shadow-[0_0_40px_rgba(139,92,246,0.08)] overflow-hidden"
    >
      {/* Header glow */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-500/50 to-transparent" />

      {/* Title row */}
      <div className="flex items-center gap-3 mb-5">
        <div className="p-2 rounded-lg bg-violet-500/10 border border-violet-500/20">
          <Cpu className="w-4 h-4 text-violet-400" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-white tracking-wide">Predictive Rollout Engine</h3>
          <p className="text-[11px] text-slate-500 font-mono mt-0.5">World Model · GRU + VAE · Imagined Trajectories</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {modelStatus !== null && (
            <span className={`text-[10px] px-2 py-0.5 rounded-full border font-mono ${
              hasModel
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
            }`}>
              {hasModel ? `✓ Trained ${modelStatus.updatedAt ? new Date(modelStatus.updatedAt).toLocaleDateString() : ''}` : '⚠ Not yet trained'}
            </span>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
        {/* Action selector */}
        <div>
          <label className="text-[11px] text-slate-500 uppercase tracking-widest mb-2 block">Imagined Action</label>
          <div className="grid grid-cols-4 gap-1.5">
            {AGENT_ACTIONS.map(a => (
              <button
                key={a.index}
                onClick={() => setSelectedAction(a.index)}
                className={`flex flex-col items-center gap-1 p-2 rounded-lg border text-[10px] font-mono transition-all duration-200 ${
                  selectedAction === a.index
                    ? 'border-violet-500/60 bg-violet-500/15 text-violet-300 shadow-[0_0_12px_rgba(139,92,246,0.2)]'
                    : 'border-gray-800 bg-gray-900/40 text-slate-500 hover:border-gray-700 hover:text-slate-400'
                }`}
              >
                <span className="text-base leading-none">{a.icon}</span>
                <span className="leading-tight text-center">{a.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Horizon slider */}
        <div>
          <label className="text-[11px] text-slate-500 uppercase tracking-widest mb-2 flex justify-between">
            <span>Horizon</span>
            <span className="text-violet-400 font-bold">{horizon} steps</span>
          </label>
          <input
            type="range" min={1} max={30} value={horizon}
            onChange={e => setHorizon(Number(e.target.value))}
            className="w-full accent-violet-500 mb-3"
          />
          <button
            onClick={runRollout}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold transition-all duration-200 shadow-[0_0_20px_rgba(139,92,246,0.3)] hover:shadow-[0_0_30px_rgba(139,92,246,0.5)]"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            {loading ? 'Simulating...' : `Imagine ${actionInfo.icon} ${actionInfo.label}`}
          </button>
        </div>
      </div>

      {/* Results */}
      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.35 }}
          >
            {!result.success ? (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                {result.error ?? 'Rollout failed'}
              </div>
            ) : (
              <>
                {/* Summary stats */}
                <div className="grid grid-cols-3 gap-3 mb-4">
                  {[
                    { label: 'Cumulative Reward', value: result.cumulativeReward.toFixed(4), icon: <Zap className="w-3 h-3" />, color: 'text-yellow-400' },
                    { label: 'Steps Simulated', value: result.horizon, icon: <Target className="w-3 h-3" />, color: 'text-violet-400' },
                    { label: 'Avg Uncertainty', value: (result.steps.reduce((s, x) => s + x.uncertainty, 0) / result.steps.length).toFixed(3), icon: <Activity className="w-3 h-3" />, color: 'text-cyan-400' },
                  ].map(stat => (
                    <div key={stat.label} className="p-3 rounded-xl bg-gray-900/60 border border-gray-800/60">
                      <div className={`flex items-center gap-1.5 ${stat.color} mb-1`}>
                        {stat.icon}
                        <span className="text-[10px] uppercase tracking-wider">{stat.label}</span>
                      </div>
                      <div className="text-white font-bold text-lg font-mono">{stat.value}</div>
                    </div>
                  ))}
                </div>

                {/* Trajectory chart */}
                <div className="mb-4 rounded-xl bg-gray-950/60 border border-gray-800/40 p-3">
                  <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-3">Predicted Reward Trajectory + Uncertainty Envelope</p>
                  <ResponsiveContainer width="100%" height={180}>
                    <AreaChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                      <defs>
                        <linearGradient id="rewardGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="upperGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.15} />
                          <stop offset="95%" stopColor="#22d3ee" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                      <XAxis dataKey="step" tick={{ fontSize: 9, fill: '#6b7280' }} />
                      <YAxis tick={{ fontSize: 9, fill: '#6b7280' }} />
                      <Tooltip
                        contentStyle={{ background: '#0f0f1a', border: '1px solid #2d2d4a', borderRadius: 8, fontSize: 11 }}
                        labelStyle={{ color: '#a78bfa' }}
                      />
                      <Area type="monotone" dataKey="upperBound" stroke="none" fill="url(#upperGrad)" name="Upper Bound" />
                      <Area type="monotone" dataKey="reward" stroke="#8b5cf6" strokeWidth={2} fill="url(#rewardGrad)" name="Reward" />
                      <Area type="monotone" dataKey="lowerBound" stroke="none" fill="transparent" name="Lower Bound" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                {/* Cumulative reward + done prob chart */}
                <div className="mb-4 rounded-xl bg-gray-950/60 border border-gray-800/40 p-3">
                  <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-3">Cumulative Reward vs Done Probability</p>
                  <ResponsiveContainer width="100%" height={120}>
                    <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                      <XAxis dataKey="step" tick={{ fontSize: 9, fill: '#6b7280' }} />
                      <YAxis tick={{ fontSize: 9, fill: '#6b7280' }} />
                      <Tooltip contentStyle={{ background: '#0f0f1a', border: '1px solid #2d2d4a', borderRadius: 8, fontSize: 11 }} />
                      <Legend wrapperStyle={{ fontSize: 10, color: '#6b7280' }} />
                      <Line type="monotone" dataKey="cumReward" stroke="#10b981" strokeWidth={2} dot={false} name="Cumulative Reward" />
                      <Line type="monotone" dataKey="donePct" stroke="#ef4444" strokeWidth={1.5} strokeDasharray="4 2" dot={false} name="Done Prob" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                {/* Step cards */}
                <div>
                  <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-2">Step Breakdown</p>
                  <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1 scrollbar-thin">
                    {result.steps.map((s, i) => (
                      <motion.div
                        key={s.step}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.03 }}
                        className="rounded-lg border border-gray-800/60 bg-gray-900/40 overflow-hidden"
                      >
                        <button
                          onClick={() => setExpandedStep(expandedStep === s.step ? null : s.step)}
                          className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-gray-800/30 transition-colors"
                        >
                          <span className="text-[10px] font-mono text-violet-400 w-8">T+{s.step}</span>
                          <div className="flex-1 flex items-center gap-3">
                            <span className="text-[11px] text-slate-300 font-mono">
                              r: <span className={s.reward >= 0 ? 'text-emerald-400' : 'text-red-400'}>{s.reward.toFixed(4)}</span>
                            </span>
                            <span className="text-[11px] text-slate-500 font-mono">
                              σ: <span className="text-cyan-400">{s.uncertainty.toFixed(3)}</span>
                            </span>
                            {s.done && (
                              <span className="text-[10px] bg-red-500/10 border border-red-500/20 text-red-400 px-1.5 rounded">TERMINAL</span>
                            )}
                          </div>
                          {expandedStep === s.step ? (
                            <ChevronUp className="w-3 h-3 text-slate-600" />
                          ) : (
                            <ChevronDown className="w-3 h-3 text-slate-600" />
                          )}
                        </button>

                        <AnimatePresence>
                          {expandedStep === s.step && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2 }}
                              className="px-3 pb-2 border-t border-gray-800/40"
                            >
                              <p className="text-[10px] text-slate-600 uppercase tracking-widest mt-2 mb-1.5">Predicted State Vector</p>
                              <div className="grid grid-cols-2 gap-1.5">
                                {s.state.slice(0, 4).map((val, idx) => (
                                  <div key={idx} className="flex items-center justify-between bg-black/30 rounded px-2 py-1">
                                    <span className="text-[10px] text-slate-500">{STATE_DIM_LABELS[idx] ?? `dim[${idx}]`}</span>
                                    <span className="text-[10px] font-mono text-indigo-300">{val.toFixed(4)}</span>
                                  </div>
                                ))}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom glow */}
      <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-violet-500/20 to-transparent" />
    </motion.div>
  );
}
