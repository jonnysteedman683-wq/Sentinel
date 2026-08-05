import React, { useState, useEffect, useRef } from 'react';
import { 
  Cpu, Play, ToggleLeft, ToggleRight, Settings, History, 
  Gauge, Server, Activity, ShieldAlert, RefreshCw, CheckCircle, Flame
} from 'lucide-react';
import { motion } from 'motion/react';

export interface CognitiveDecision {
  timestamp: number;
  actionId: number;
  actionName: string;
  reward: number;
  details?: string;
  stateVector?: number[];
}

interface SystemMetrics {
  memoryUsageRatio: number;
  cpuLoad: number;
  activeWorkerCount: number;
  pendingTaskQueueSize: number;
  firestoreReadErrors: number;
  firestoreWriteErrors: number;
  geminiLatencyMs: number;
  unhandledErrors: number;
  dreamCycleFailureRate: number;
}

interface MaintenanceHistoryItem {
  id: string;
  timestamp: number;
  actionTaken: string;
  memoryUsageRatio?: number;
  cpuLoad?: number;
  firestoreReadErrors?: number;
  firestoreWriteErrors?: number;
  geminiLatencyMs?: number;
  dreamCycleFailureRate?: number;
  unhandledErrors?: number;
  activeWorkerCount?: number;
}

interface AutonomyPanelProps {
  isAutonomyActive: boolean;
  setIsAutonomyActive: (active: boolean) => void;
  autonomyInterval: number;
  setAutonomyInterval: (interval: number) => void;
  cognitiveDecisions: CognitiveDecision[];
  triggerManualStep: () => Promise<void>;
  modelState: string;
  agentStats: { epsilon: number; episodes: number; lastAction: number };
  addLog: (message: string, level?: any, source?: string) => void;
}

export const AutonomyPanel: React.FC<AutonomyPanelProps> = ({
  isAutonomyActive,
  setIsAutonomyActive,
  autonomyInterval,
  setAutonomyInterval,
  cognitiveDecisions,
  triggerManualStep,
  modelState,
  addLog
}) => {
  // DevOps States
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [maintenanceHistory, setMaintenanceHistory] = useState<MaintenanceHistoryItem[]>([]);
  const [isHealerRunning, setIsHealerRunning] = useState<Record<string, boolean>>({});
  const [isLoadingMetrics, setIsLoadingMetrics] = useState(true);
  const [nextStepCountdown, setNextStepCountdown] = useState<number>(0);
  const lastCycleTimeRef = useRef<number>(Date.now());

  // Set up countdown timer for next cycle
  useEffect(() => {
    if (!isAutonomyActive) {
      setNextStepCountdown(0);
      return;
    }

    // Reset countdown initially
    const intervalSec = Math.floor(autonomyInterval / 1000);
    setNextStepCountdown(intervalSec);
    lastCycleTimeRef.current = Date.now();

    const timer = setInterval(() => {
      const elapsed = Date.now() - lastCycleTimeRef.current;
      const remaining = Math.max(0, intervalSec - Math.floor(elapsed / 1000));
      setNextStepCountdown(remaining);

      if (remaining <= 0) {
        lastCycleTimeRef.current = Date.now();
        setNextStepCountdown(intervalSec);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [isAutonomyActive, autonomyInterval, cognitiveDecisions.length]);

  // Sync metrics and maintenance logs periodically
  const fetchDevOpsStatus = async () => {
    try {
      const [metricsRes, historyRes] = await Promise.all([
        fetch('/api/system/health'),
        fetch('/api/system/maintenance-history')
      ]);

      if (metricsRes.ok) {
        const data = await metricsRes.json();
        setMetrics(data);
      }
      if (historyRes.ok) {
        const historyData = await historyRes.json();
        setMaintenanceHistory(historyData);
      }
    } catch (e) {
      console.error('[AutonomyPanel] Failed to fetch server DevOps status:', e);
    } finally {
      setIsLoadingMetrics(false);
    }
  };

  useEffect(() => {
    fetchDevOpsStatus();
    const metricsInterval = setInterval(fetchDevOpsStatus, 5000); // refresh every 5 seconds
    return () => clearInterval(metricsInterval);
  }, []);

  const handleManualTrigger = async () => {
    if (modelState !== 'Idle') return;
    try {
      addLog('User initiated on-demand manual cognitive step wave.', 'INFO', 'RL_ENGINE');
      await triggerManualStep();
    } catch (e: any) {
      addLog(`Manual wave trigger failed: ${e.message}`, 'CRITICAL', 'RL_ENGINE');
    }
  };

  const dispatchHealingAction = async (actionType: string) => {
    setIsHealerRunning(prev => ({ ...prev, [actionType]: true }));
    addLog(`Dispatching server-side self-healing directive: ${actionType}`, 'WARNING', 'DEVOPS');
    try {
      const res = await fetch('/api/system/execute-healing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actionType })
      });

      if (res.ok) {
        const data = await res.json();
        addLog(`Self-healing completed: ${data.message || 'Operation successful'}`, 'NEURAL', 'DEVOPS');
        fetchDevOpsStatus();
      } else {
        const err = await res.json();
        addLog(`Self-healing failed: ${err.error || 'Server error'}`, 'CRITICAL', 'DEVOPS');
      }
    } catch (e: any) {
      addLog(`Failed to compile self-healing call: ${e.message}`, 'CRITICAL', 'DEVOPS');
    } finally {
      setIsHealerRunning(prev => ({ ...prev, [actionType]: false }));
    }
  };

  const getSystemStatusLabel = () => {
    if (!metrics) return { text: 'OFFLINE', color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20' };
    const score = 
      metrics.memoryUsageRatio + 
      metrics.cpuLoad + 
      (metrics.firestoreReadErrors > 0 ? 0.3 : 0) + 
      (metrics.firestoreWriteErrors > 0 ? 0.3 : 0) + 
      (metrics.dreamCycleFailureRate > 0.1 ? 0.2 : 0) + 
      (metrics.unhandledErrors > 0 ? 0.4 : 0);

    if (score < 0.8) {
      return { text: 'OPTIMAL / NOMINAL', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' };
    } else if (score < 1.5) {
      return { text: 'STEADY / DEGRADED', color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' };
    } else {
      return { text: 'COMPROMISED / HEALING', color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20' };
    }
  };

  const currentStatus = getSystemStatusLabel();

  return (
    <div id="autonomy-panel-container" className="flex flex-col space-y-6 w-full animate-in fade-in duration-300">
      {/* SECTION 1: COGNITIVE AUTONOMY LOOP */}
      <div id="cognitive-autonomy-section" className="bg-zinc-900/40 border border-white/5 rounded-2xl p-5 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
          <Cpu className="w-16 h-16 text-indigo-400" />
        </div>

        {/* HEADER */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-indigo-400 animate-pulse" />
            <h4 className="text-white text-xs font-bold uppercase tracking-widest">Cognitive Autonomy Core</h4>
          </div>
          <button
            id="autonomy-toggle-btn"
            onClick={() => {
              const nextState = !isAutonomyActive;
              setIsAutonomyActive(nextState);
              addLog(`Cognitive Autonomy loop toggled ${nextState ? 'ACTIVE' : 'STANDBY (MANUAL OVERRIDE)'}`, nextState ? 'NEURAL' : 'WARNING', 'RL_ENGINE');
            }}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all border ${
              isAutonomyActive 
                ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.15)]' 
                : 'bg-zinc-800/50 border-white/5 text-zinc-400 hover:border-zinc-700 hover:text-zinc-300'
            }`}
          >
            {isAutonomyActive ? (
              <>
                <ToggleRight className="w-4 h-4 text-indigo-400" />
                AUTONOMY ACTIVE
              </>
            ) : (
              <>
                <ToggleLeft className="w-4 h-4 text-zinc-500" />
                MANUAL STANDBY
              </>
            )}
          </button>
        </div>

        <p className="text-[11px] text-zinc-400 leading-relaxed mb-5">
          Controls the client-side reinforcement learning ambient loop. When active, the agent queries state embeddings and executes proactive decisions asynchronously.
        </p>

        {/* CONTROLS GRID */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
          {/* INTERVAL SELECTOR */}
          <div className="bg-black/30 border border-white/5 rounded-xl p-3 flex flex-col justify-between">
            <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-wider block mb-2">
              Wave Frequency (Interval)
            </span>
            <div className="relative">
              <select
                id="autonomy-interval-select"
                value={autonomyInterval}
                onChange={(e) => {
                  const ms = Number(e.target.value);
                  setAutonomyInterval(ms);
                  addLog(`Cognitive Autonomy interval adjusted to ${ms / 1000} seconds.`, 'INFO', 'RL_ENGINE');
                }}
                className="w-full bg-zinc-950 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 font-mono focus:outline-none focus:border-indigo-500/50 cursor-pointer appearance-none"
              >
                <option value={10000}>Hyper-Reactive (10s)</option>
                <option value={25000}>Balanced Ambient (25s)</option>
                <option value={60000}>Consolidated Obs. (60s)</option>
                <option value={300000}>Deep Periodic (5m)</option>
                <option value={900000}>Slow/Passive (15m)</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-zinc-400">
                <Settings className="w-3 h-3 text-zinc-500" />
              </div>
            </div>
          </div>

          {/* PROGRESS OR MANUAL BUTTON */}
          <div className="bg-black/30 border border-white/5 rounded-xl p-3 flex flex-col justify-between min-h-[64px]">
            {isAutonomyActive ? (
              <div className="flex flex-col h-full justify-between">
                <div className="flex justify-between items-center text-[9px] font-mono text-zinc-500 uppercase tracking-wider">
                  <span>Next Inference Wave</span>
                  <span className="text-indigo-400 font-bold">{nextStepCountdown}s</span>
                </div>
                <div className="w-full bg-zinc-950 h-1.5 rounded-full overflow-hidden mt-2 relative">
                  <motion.div 
                    className="h-full bg-indigo-500"
                    initial={{ width: "100%" }}
                    animate={{ width: `${(nextStepCountdown / (autonomyInterval / 1000)) * 100}%` }}
                    transition={{ ease: "linear", duration: 1 }}
                  />
                </div>
              </div>
            ) : (
              <div className="flex flex-col h-full justify-center">
                <button
                  id="manual-step-trigger"
                  onClick={handleManualTrigger}
                  disabled={modelState !== 'Idle'}
                  className="w-full bg-indigo-500/10 border border-indigo-500/20 hover:bg-indigo-500/20 disabled:opacity-40 disabled:cursor-not-allowed text-indigo-400 font-bold uppercase tracking-widest text-[9px] py-2 rounded-lg transition-all flex items-center justify-center gap-1.5"
                >
                  <Play className="w-3 h-3 fill-current" />
                  Trigger Cognitive Wave
                </button>
              </div>
            )}
          </div>
        </div>

        {/* DECISION STREAM */}
        <div className="border-t border-white/5 pt-4">
          <div className="flex items-center gap-1.5 mb-3">
            <History className="w-3.5 h-3.5 text-indigo-400" />
            <h5 className="text-zinc-300 text-[10px] font-bold uppercase tracking-wider">Real-Time Decision Stream</h5>
          </div>

          <div id="decision-history-list" className="space-y-2 max-h-[160px] overflow-y-auto custom-scrollbar pr-1">
            {cognitiveDecisions.length === 0 ? (
              <div className="text-center py-4 text-[10px] text-zinc-600 font-mono italic bg-black/10 border border-white/5 rounded-lg">
                Waiting for the first autonomous decision wave...
              </div>
            ) : (
              cognitiveDecisions.slice(0, 5).map((decision, index) => (
                <div 
                  key={decision.timestamp + '-' + index}
                  className="bg-zinc-950/40 border border-white/5 rounded-xl p-2.5 flex items-center justify-between text-xs"
                >
                  <div className="flex flex-col gap-0.5 max-w-[70%]">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-zinc-300 text-[11px] tracking-wide">
                        {decision.actionName}
                      </span>
                      <span className="text-[8px] bg-zinc-800 text-zinc-500 px-1 rounded font-mono">
                        A#{decision.actionId}
                      </span>
                    </div>
                    {decision.details && (
                      <span className="text-[9px] text-zinc-500 truncate leading-relaxed">
                        {decision.details}
                      </span>
                    )}
                  </div>
                  <div className="text-right flex flex-col gap-0.5">
                    <span className="text-[9px] font-mono text-zinc-500 block">
                      {new Date(decision.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                    <span className={`text-[9px] font-mono font-bold ${decision.reward >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      R: {decision.reward >= 0 ? '+' : ''}{decision.reward.toFixed(2)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* SECTION 2: DEVOPS SELF-HEALING & SERVER METRICS */}
      <div id="devops-autonomy-section" className="bg-zinc-900/40 border border-white/5 rounded-2xl p-5 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
          <Server className="w-16 h-16 text-teal-400" />
        </div>

        {/* HEADER */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Server className="w-4 h-4 text-teal-400" />
            <h4 className="text-white text-xs font-bold uppercase tracking-widest font-sans">DevOps Orchestrator Telemetry</h4>
          </div>
          <div className={`px-2.5 py-1 rounded-full text-[9px] font-mono font-bold uppercase border ${currentStatus.bg} ${currentStatus.color}`}>
            {currentStatus.text}
          </div>
        </div>

        <p className="text-[11px] text-zinc-400 leading-relaxed mb-5">
          Monitors server-side anomalies. The server-side DevOps brain automatically heals issues such as memory exhaustion, high request queues, or Firestore read/write blocks.
        </p>

        {/* LIVE METRICS TILES */}
        {isLoadingMetrics ? (
          <div className="flex flex-col items-center justify-center py-6 gap-2">
            <RefreshCw className="w-6 h-6 text-teal-400 animate-spin" />
            <span className="text-[10px] font-mono text-zinc-500">Querying live server vitals...</span>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
            {/* Heap load */}
            <div className="bg-black/30 border border-white/5 rounded-xl p-3 flex flex-col justify-between min-h-[64px]">
              <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-wider block">Heap Ratio</span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-sm font-mono text-zinc-200">
                  {metrics ? `${(metrics.memoryUsageRatio * 100).toFixed(1)}%` : '0.0%'}
                </span>
                {metrics && metrics.memoryUsageRatio > 0.8 && (
                  <ShieldAlert className="w-3.5 h-3.5 text-red-400 animate-bounce" />
                )}
              </div>
              <div className="w-full bg-zinc-950 h-1 rounded-full overflow-hidden mt-1.5">
                <div 
                  className={`h-full ${metrics && metrics.memoryUsageRatio > 0.8 ? 'bg-red-500' : 'bg-teal-500'}`}
                  style={{ width: metrics ? `${metrics.memoryUsageRatio * 100}%` : '0%' }}
                />
              </div>
            </div>

            {/* Gemini Latency */}
            <div className="bg-black/30 border border-white/5 rounded-xl p-3 flex flex-col justify-between min-h-[64px]">
              <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-wider block">Gemini Latency</span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-sm font-mono text-zinc-200">
                  {metrics ? `${Math.round(metrics.geminiLatencyMs)}ms` : '0ms'}
                </span>
                <Gauge className="w-3.5 h-3.5 text-zinc-600" />
              </div>
              <div className="w-full bg-zinc-950 h-1 rounded-full overflow-hidden mt-1.5">
                <div 
                  className="h-full bg-teal-500"
                  style={{ width: metrics ? `${Math.min(100, (metrics.geminiLatencyMs / 2000) * 100)}%` : '0%' }}
                />
              </div>
            </div>

            {/* Active Workers */}
            <div className="bg-black/30 border border-white/5 rounded-xl p-3 flex flex-col justify-between min-h-[64px]">
              <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-wider block">Web Workers</span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-sm font-mono text-zinc-200">
                  {metrics ? metrics.activeWorkerCount : '0'} / 8
                </span>
                <Activity className="w-3.5 h-3.5 text-zinc-600" />
              </div>
              <div className="w-full bg-zinc-950 h-1 rounded-full overflow-hidden mt-1.5">
                <div 
                  className="h-full bg-teal-500"
                  style={{ width: metrics ? `${(metrics.activeWorkerCount / 8) * 100}%` : '0%' }}
                />
              </div>
            </div>

            {/* Firestore Errors */}
            <div className="bg-black/30 border border-white/5 rounded-xl p-3 flex flex-col justify-between min-h-[64px]">
              <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-wider block">Firestore IO Err</span>
              <div className="flex items-baseline justify-between mt-1">
                <span className={`text-sm font-mono ${(metrics?.firestoreReadErrors || 0) + (metrics?.firestoreWriteErrors || 0) > 0 ? 'text-red-400 font-bold' : 'text-zinc-200'}`}>
                  {metrics ? metrics.firestoreReadErrors + metrics.firestoreWriteErrors : '0'}
                </span>
                <CheckCircle className={`w-3.5 h-3.5 ${((metrics?.firestoreReadErrors || 0) + (metrics?.firestoreWriteErrors || 0)) > 0 ? 'text-red-400 animate-pulse' : 'text-zinc-600'}`} />
              </div>
              <div className="text-[8px] font-mono text-zinc-500 mt-1 truncate">
                R: {metrics?.firestoreReadErrors || 0} | W: {metrics?.firestoreWriteErrors || 0}
              </div>
            </div>

            {/* Dream failure rate */}
            <div className="bg-black/30 border border-white/5 rounded-xl p-3 flex flex-col justify-between min-h-[64px]">
              <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-wider block">Dream Fail Rate</span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-sm font-mono text-zinc-200">
                  {metrics ? `${(metrics.dreamCycleFailureRate * 100).toFixed(0)}%` : '0%'}
                </span>
                <Flame className="w-3.5 h-3.5 text-zinc-600" />
              </div>
              <div className="w-full bg-zinc-950 h-1 rounded-full overflow-hidden mt-1.5">
                <div 
                  className="h-full bg-teal-500"
                  style={{ width: metrics ? `${metrics.dreamCycleFailureRate * 100}%` : '0%' }}
                />
              </div>
            </div>

            {/* Unhandled Errors */}
            <div className="bg-black/30 border border-white/5 rounded-xl p-3 flex flex-col justify-between min-h-[64px]">
              <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-wider block">System Crashes</span>
              <div className="flex items-baseline justify-between mt-1">
                <span className={`text-sm font-mono ${metrics && metrics.unhandledErrors > 0 ? 'text-red-400 font-bold' : 'text-zinc-200'}`}>
                  {metrics ? metrics.unhandledErrors : '0'}
                </span>
                <ShieldAlert className={`w-3.5 h-3.5 ${metrics && metrics.unhandledErrors > 0 ? 'text-red-400 animate-pulse' : 'text-zinc-600'}`} />
              </div>
              <div className="text-[8px] font-mono text-zinc-500 mt-1 truncate">
                Unhandled events logged
              </div>
            </div>
          </div>
        )}

        {/* MANUAL INTERVENTION TRIGGERS */}
        <div className="border-t border-white/5 pt-4 mb-4">
          <div className="flex items-center gap-1.5 mb-3">
            <Settings className="w-3.5 h-3.5 text-teal-400" />
            <h5 className="text-zinc-300 text-[10px] font-bold uppercase tracking-wider">Manual Healer Interventions</h5>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            <button
              onClick={() => dispatchHealingAction('TRIGGER_GARBAGE_COLLECTION')}
              disabled={isHealerRunning['TRIGGER_GARBAGE_COLLECTION']}
              className="bg-zinc-800/50 border border-white/5 hover:bg-zinc-800 hover:border-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed text-[10px] text-zinc-300 font-bold py-2 rounded-lg font-mono transition-all uppercase flex items-center justify-center gap-1.5"
            >
              {isHealerRunning['TRIGGER_GARBAGE_COLLECTION'] ? (
                <RefreshCw className="w-3 h-3 text-teal-400 animate-spin" />
              ) : (
                <RefreshCw className="w-3 h-3 text-teal-400" />
              )}
              Force Heap GC
            </button>

            <button
              onClick={() => dispatchHealingAction('REDUCE_BATCH_SIZE')}
              disabled={isHealerRunning['REDUCE_BATCH_SIZE']}
              className="bg-zinc-800/50 border border-white/5 hover:bg-zinc-800 hover:border-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed text-[10px] text-zinc-300 font-bold py-2 rounded-lg font-mono transition-all uppercase flex items-center justify-center gap-1.5"
            >
              {isHealerRunning['REDUCE_BATCH_SIZE'] ? (
                <RefreshCw className="w-3 h-3 text-teal-400 animate-spin" />
              ) : (
                <Settings className="w-3 h-3 text-teal-400" />
              )}
              Reduce Batch
            </button>

            <button
              onClick={() => dispatchHealingAction('INCREASE_RETRY_DELAY')}
              disabled={isHealerRunning['INCREASE_RETRY_DELAY']}
              className="bg-zinc-800/50 border border-white/5 hover:bg-zinc-800 hover:border-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed text-[10px] text-zinc-300 font-bold py-2 rounded-lg font-mono transition-all uppercase flex items-center justify-center gap-1.5"
            >
              {isHealerRunning['INCREASE_RETRY_DELAY'] ? (
                <RefreshCw className="w-3 h-3 text-teal-400 animate-spin" />
              ) : (
                <Gauge className="w-3 h-3 text-teal-400" />
              )}
              Dilate Retry
            </button>
          </div>
        </div>

        {/* HEALING HISTORY LOG */}
        <div className="border-t border-white/5 pt-4">
          <div className="flex items-center gap-1.5 mb-3">
            <History className="w-3.5 h-3.5 text-teal-400" />
            <h5 className="text-zinc-300 text-[10px] font-bold uppercase tracking-wider">DevOps Self-Healing Log</h5>
          </div>

          <div id="devops-history-list" className="space-y-2 max-h-[140px] overflow-y-auto custom-scrollbar pr-1">
            {maintenanceHistory.length === 0 ? (
              <div className="text-center py-4 text-[10px] text-zinc-600 font-mono italic bg-black/10 border border-white/5 rounded-lg">
                No automatic healing logs detected in this session.
              </div>
            ) : (
              maintenanceHistory.map((item) => (
                <div 
                  key={item.id}
                  className="bg-zinc-950/40 border border-white/5 rounded-xl p-2.5 flex flex-col gap-1 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-teal-400 text-[10px] tracking-wide font-mono">
                      {item.actionTaken}
                    </span>
                    <span className="text-[9px] font-mono text-zinc-500">
                      {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                  </div>
                  <div className="text-[9px] font-mono text-zinc-500 grid grid-cols-3 gap-x-2 gap-y-0.5 border-t border-white/5 pt-1 mt-0.5">
                    <span>Memory: {(item.memoryUsageRatio ? item.memoryUsageRatio * 100 : 0).toFixed(0)}%</span>
                    <span>CPU: {(item.cpuLoad ? item.cpuLoad * 100 : 0).toFixed(0)}%</span>
                    <span>Err count: {(item.firestoreReadErrors || 0) + (item.firestoreWriteErrors || 0)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
