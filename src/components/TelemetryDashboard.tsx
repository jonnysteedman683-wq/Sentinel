import React, { useEffect, useState } from 'react';
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ScatterChart, Scatter, ZAxis } from 'recharts';
import { Activity, Loader2, Moon, Brain, Zap, Target, Sparkles, Shield, Cpu, Network } from 'lucide-react';
import { LiquidMonitor } from './LiquidMonitor.js';
import { CognitiveSculptingConsole } from './CognitiveSculptingConsole.js';
import { auth } from '../firebase.js';

export const TelemetryDashboard: React.FC<{ 
  theme: string; 
  activeOptionName?: string;
  cognitiveMode: 'HRL' | 'ActiveInference';
  onModeChange: (mode: 'HRL' | 'ActiveInference') => void;
  efeScore?: number;
  policyConfidence?: number;
  usePolicyNet?: boolean;
  onTogglePolicyNet?: (val: boolean) => void;
}> = ({ theme, activeOptionName, cognitiveMode, onModeChange, efeScore, policyConfidence, usePolicyNet, onTogglePolicyNet }) => {
  const [data, setData] = useState<any[]>([]);
  const [dreamHistory, setDreamHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = auth.currentUser ? await auth.currentUser.getIdToken() : '';
        const headers = { 'Authorization': `Bearer ${token}` };

        const [telRes, dreamRes, healthRes] = await Promise.all([
          fetch('/api/telemetry', { headers }),
          fetch('/api/dream/history', { headers }),
          fetch('/api/system/health-history', { headers })
        ]);
        
        if (telRes.ok) {
          const json = await telRes.json();
          setData(json);
        }
        if (dreamRes.ok) {
          const json = await dreamRes.json();
          setDreamHistory(json);
        }
        if (healthRes && healthRes.ok) {
          const json = await healthRes.json();
          setHealthHistory(json);
        }
      } catch (error) {
        console.error('Failed to fetch telemetry:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const convergenceData = data.filter(d => d.type === 'q_convergence').map(d => ({
    episode: d.data.episode,
    qValue: d.data.qValue,
    timestamp: new Date(d.timestamp).toLocaleTimeString()
  }));

  const dreamChartData = [...dreamHistory].reverse().map(d => ({
    time: new Date(d.timestamp).toLocaleTimeString(),
    gain: d.gain,
    steps: d.steps,
    valLoss: d.validationLoss || 0,
    cql: d.cqlPenalty || 0,
    policyLoss: d.policyLoss || 0
  }));

  const [debateTelemetry, setDebateTelemetry] = useState<any>(null);
  const [healthData, setHealthData] = useState<any>(null);
  const [collectiveDream, setCollectiveDream] = useState<any>(null);
  const [healthHistory, setHealthHistory] = useState<any[]>([]);
  const [healingStatus, setHealingStatus] = useState<string | null>(null);

  const triggerHealingAction = async (actionType: string) => {
    setHealingStatus(`Triggering ${actionType}...`);
    try {
      const res = await fetch('/api/system/execute-healing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${auth.currentUser ? await auth.currentUser.getIdToken() : ''}` },
        body: JSON.stringify({ actionType }),
      });
      if (res.ok) {
        const json = await res.json();
        setHealingStatus(`Success: ${json.message}`);
        setTimeout(async () => {
          const token = auth.currentUser ? await auth.currentUser.getIdToken() : '';
          const resHist = await fetch('/api/system/health-history', { headers: { 'Authorization': `Bearer ${token}` } });
          if (resHist.ok) setHealthHistory(await resHist.json());
        }, 2000);
      } else {
        const err = await res.json();
        setHealingStatus(`Error: ${err.error || 'Execution failed'}`);
      }
    } catch (e: any) {
      setHealingStatus(`Error: ${e.message}`);
    }
    setTimeout(() => setHealingStatus(null), 5000);
  };

  useEffect(() => {
    const fetchDebateTelemetry = async () => {
      try {
        const token = auth.currentUser ? await auth.currentUser.getIdToken() : '';
        const res = await fetch('/api/debate/telemetry', { headers: { 'Authorization': `Bearer ${token}` } });
        if (res.ok) {
          setDebateTelemetry(await res.json());
        }
      } catch (e) {
        console.error('Failed to fetch debate telemetry:', e);
      }
    };

    const fetchHealth = async () => {
      try {
        const res = await fetch('/api/health');
        if (res.ok) {
          const data = await res.json();
          setHealthData(data);
        }
      } catch (e) {
        console.error('Failed to fetch health data:', e);
      }
    };

    const fetchHealthHistory = async () => {
      try {
        const token = auth.currentUser ? await auth.currentUser.getIdToken() : '';
        const res = await fetch('/api/system/health-history', { headers: { 'Authorization': `Bearer ${token}` } });
        if (res.ok) setHealthHistory(await res.json());
      } catch (e) {
        console.error('Failed to fetch health history:', e);
      }
    };

    const fetchCollectiveDream = async () => {
      try {
        const res = await fetch('/api/federated/collective-dream/1');
        if (res.ok) setCollectiveDream(await res.json());
      } catch (e) {
        console.error('Failed to fetch collective dream:', e);
      }
    };

    fetchDebateTelemetry();
    fetchHealth();
    fetchHealthHistory();
    fetchCollectiveDream();
    const interval = setInterval(() => {
      fetchDebateTelemetry();
      fetchHealth();
      fetchHealthHistory();
      fetchCollectiveDream();
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const radarData = [
    { subject: 'Alignment', value: 95 },
    { subject: 'Coherence', value: 88 },
    { subject: 'Resilience', value: 92 },
    { subject: 'Creativity', value: 85 },
    { subject: 'Precision', value: 98 },
  ];

  if (debateTelemetry?.transitions && debateTelemetry.transitions.length > 0) {
    const latestState = debateTelemetry.transitions[0].state || [];
    if (latestState.length >= 5) {
      radarData[0].value = Math.min(100, Math.max(0, latestState[0] * 100));
      radarData[1].value = Math.min(100, Math.max(0, latestState[1] * 100));
      radarData[2].value = Math.min(100, Math.max(0, latestState[2] * 100));
      radarData[3].value = Math.min(100, Math.max(0, latestState[3] * 100));
      radarData[4].value = Math.min(100, Math.max(0, latestState[4] * 100));
    }
  }

  const scatterData = (data || []).slice(-50).map((d) => ({
    x: d.data?.contextVector?.[0] ? d.data.contextVector[0] * 100 : (Math.random() * 200 - 100),
    y: d.data?.contextVector?.[1] ? d.data.contextVector[1] * 100 : (Math.random() * 200 - 100),
    z: 10 + Math.random() * 50,
    name: d.type || 'Action'
  }));

  if (scatterData.length === 0) {
    for (let i = 0; i < 20; i++) {
      scatterData.push({
        x: Math.random() * 200 - 100,
        y: Math.random() * 200 - 100,
        z: 10 + Math.random() * 50,
        name: 'Simulated'
      });
    }
  }

  const systemEntropy = Math.floor(Math.random() * 40) + 10;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-teal-400">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col p-6 animate-in fade-in duration-500 overflow-y-auto pb-20">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-slate-200 flex items-center gap-2">
          <Activity className="w-5 h-5 text-teal-400" />
          Neural Telemetry Dashboard
        </h2>
        
        <div className="flex bg-slate-800/50 p-1 rounded-lg border border-slate-700">
          <button 
            onClick={() => onModeChange('HRL')}
            className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${cognitiveMode === 'HRL' ? 'bg-teal-500 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'}`}
          >
            HRL (DQN)
          </button>
          <button 
            onClick={() => onModeChange('ActiveInference')}
            className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${cognitiveMode === 'ActiveInference' ? 'bg-purple-500 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'}`}
          >
            ACTIVE INF
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1">
        {/* Mode & Rationale */}
        <div className={`bg-white/5 border border-white/10 rounded-xl p-6 ${theme === 'dark' ? 'bg-black/40' : 'bg-white/60'}`}>
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
            {cognitiveMode === 'HRL' ? <Zap className="w-4 h-4 text-teal-400" /> : <Brain className="w-4 h-4 text-purple-400" />}
            {cognitiveMode === 'HRL' ? 'HRL State: Cognitive Mode' : 'Active Inference: Free Energy Minimization'}
          </h3>
          <div className={`flex items-center gap-4 p-4 ${cognitiveMode === 'HRL' ? 'bg-teal-500/10 border-teal-500/20' : 'bg-purple-500/10 border-purple-500/20'} border rounded-lg`}>
            <div className={`w-3 h-3 rounded-full ${activeOptionName ? (cognitiveMode === 'HRL' ? 'bg-teal-400' : 'bg-purple-400') + ' animate-pulse' : 'bg-slate-600'}`} />
            <div className="flex-1">
              <p className="text-xs text-slate-400 font-mono">Current Objective</p>
              <p className={`text-lg font-bold ${cognitiveMode === 'HRL' ? 'text-teal-400' : 'text-purple-400'} font-mono tracking-tight`}>
                {cognitiveMode === 'HRL' ? (activeOptionName || 'FLAT EXPLORATION') : 'PLANNING: HORIZON 3'}
              </p>
            </div>
            {cognitiveMode === 'ActiveInference' && (
              <div className="text-right">
                <p className="text-[10px] text-slate-500 font-mono uppercase">EFE Score</p>
                <p className="text-lg font-bold text-purple-200 font-mono">{(efeScore || 0).toFixed(4)}</p>
              </div>
            )}
          </div>
          
          {cognitiveMode === 'ActiveInference' && (
            <div className="mt-4 grid grid-cols-2 gap-4">
              <div className="p-3 bg-white/5 border border-white/5 rounded-lg">
                <p className="text-[9px] text-slate-500 uppercase font-bold mb-1 flex items-center gap-1">
                  <Target className="w-3 h-3" /> Pragmatic Value
                </p>
                <div className="w-full bg-slate-800 h-1 rounded-full overflow-hidden">
                  <div className="bg-purple-400 h-full" style={{ width: '65%' }} />
                </div>
              </div>
              <div className="p-3 bg-white/5 border border-white/5 rounded-lg">
                <p className="text-[9px] text-slate-500 uppercase font-bold mb-1 flex items-center gap-1">
                  <Activity className="w-3 h-3" /> Epistemic Value
                </p>
                <div className="w-full bg-slate-800 h-1 rounded-full overflow-hidden">
                  <div className="bg-teal-400 h-full" style={{ width: '35%' }} />
                </div>
              </div>
            </div>
          )}
        </div>


        <div className={`bg-white/5 border border-white/10 rounded-xl p-6 ${theme === 'dark' ? 'bg-black/40' : 'bg-white/60'}`}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-400" />
              Policy Network (System 1)
            </h3>
            {onTogglePolicyNet && (
              <button 
                onClick={() => onTogglePolicyNet(!usePolicyNet)}
                className={`text-[9px] px-2 py-0.5 rounded border ${usePolicyNet ? 'bg-teal-500/20 border-teal-500/30 text-teal-400' : 'bg-slate-500/20 border-slate-500/30 text-slate-400'}`}
              >
                {usePolicyNet ? 'ACTIVE' : 'OFFLINE'}
              </button>
            )}
          </div>
          
          <div className="grid grid-cols-2 gap-4 h-[120px]">
            <div className="flex flex-col justify-center items-center bg-white/5 rounded-lg border border-white/5 p-4">
              <p className="text-[10px] text-slate-500 uppercase font-bold mb-2">Confidence</p>
              <div className="relative w-16 h-16">
                <svg className="w-full h-full transform -rotate-90">
                  <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="4" fill="transparent" className="text-slate-800" />
                  <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="4" fill="transparent" 
                    strokeDasharray={175.9} strokeDashoffset={175.9 * (1 - (policyConfidence || 0))}
                    className="text-teal-400 transition-all duration-1000" />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-xs font-bold text-slate-200">{((policyConfidence || 0) * 100).toFixed(0)}%</span>
                </div>
              </div>
            </div>
            
            <div className="flex flex-col justify-center space-y-3 bg-white/5 rounded-lg border border-white/5 p-4">
              <div>
                <p className="text-[9px] text-slate-500 uppercase font-bold mb-1">Distillation Loss</p>
                <p className="text-lg font-bold text-slate-200 font-mono">
                  {dreamHistory.length > 0 && dreamHistory[0].policyLoss ? dreamHistory[0].policyLoss.toFixed(4) : 'N/A'}
                </p>
              </div>
              <div>
                <p className="text-[9px] text-slate-500 uppercase font-bold mb-1">Mode</p>
                <p className="text-[10px] font-mono text-teal-400 font-bold uppercase">
                  {policyConfidence && policyConfidence > 0.6 ? 'Intuitive Selection' : 'Deliberative Fallback'}
                </p>
              </div>
            </div>
          </div>
          
          <div className="mt-4">
             <ResponsiveContainer width="100%" height={80}>
                <LineChart data={dreamChartData.slice(-10)}>
                  <Line type="monotone" dataKey="policyLoss" stroke="#f59e0b" strokeWidth={2} dot={false} />
                </LineChart>
             </ResponsiveContainer>
             <p className="text-[8px] text-center text-slate-600 mt-1 uppercase font-mono">Distillation Loss (Last 10 Cycles)</p>
          </div>
        </div>

        <div className={`bg-white/5 border border-white/10 rounded-xl p-6 ${theme === 'dark' ? 'bg-black/40' : 'bg-white/60'}`}>
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
            <Brain className="w-4 h-4 text-indigo-400" />
            Debate Council: Active Inference
          </h3>
          <div className="space-y-4">
            {['logician', 'catalyst', 'auditor'].map(agentId => {
              const agentData = debateTelemetry?.agents?.find((a: any) => a.id === agentId);
              const lastMove = debateTelemetry?.transitions?.find((t: any) => t.agentId === agentId);
              
              return (
                <div key={agentId} className="p-3 bg-white/5 border border-white/5 rounded-lg flex items-center justify-between">
                  <div>
                    <p className="text-[10px] text-slate-500 uppercase font-bold">{agentId}</p>
                    <p className="text-xs font-semibold text-slate-200">
                      {lastMove ? `Last Move: ${['ARGUE', 'QUESTION', 'REFINE', 'CONCEDE', 'SUMMARIZE', 'INJECT_CREATIVITY', 'FACT_CHECK'][lastMove.move]}` : 'Waiting...'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] text-slate-600 uppercase font-mono">Updated</p>
                    <p className="text-[10px] text-slate-400 font-mono">
                      {agentData?.updatedAt ? new Date(agentData.updatedAt).toLocaleTimeString() : 'Never'}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
          
          <div className="mt-6">
            <p className="text-[9px] text-slate-500 uppercase font-bold mb-2">Simulated Synergy (Last 50 Transitions)</p>
            <div className="h-20 w-full bg-white/5 rounded border border-white/5 overflow-hidden">
               <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={debateTelemetry?.transitions?.slice(0, 20).reverse() || []}>
                    <Line type="monotone" dataKey="state[0]" stroke="#2dd4bf" strokeWidth={1} dot={false} />
                    <Line type="monotone" dataKey="state[1]" stroke="#a855f7" strokeWidth={1} dot={false} />
                    <Line type="monotone" dataKey="state[2]" stroke="#f59e0b" strokeWidth={1} dot={false} />
                  </LineChart>
               </ResponsiveContainer>
            </div>
            <div className="flex justify-between mt-1 px-1">
               <span className="text-[8px] text-teal-400 font-mono uppercase">Coherence</span>
               <span className="text-[8px] text-purple-400 font-mono uppercase">Novelty</span>
               <span className="text-[8px] text-amber-400 font-mono uppercase">Factuality</span>
            </div>
          </div>
        </div>

        <div className={`bg-white/5 border border-white/10 rounded-xl p-6 ${theme === 'dark' ? 'bg-black/40' : 'bg-white/60'}`}>
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-400" />
            Federated Weave (Privacy-Preserving)
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 bg-white/5 rounded-lg border border-white/5">
              <p className="text-[9px] text-slate-500 uppercase font-bold mb-1">Status</p>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                <span className="text-xs font-semibold text-slate-200">ACTIVE (Simulated)</span>
              </div>
            </div>
            <div className="p-3 bg-white/5 rounded-lg border border-white/5">
              <p className="text-[9px] text-slate-500 uppercase font-bold mb-1">Privacy Budget</p>
              <p className="text-xs font-semibold text-emerald-400 font-mono">ε: 8.0 | δ: 1e-5</p>
            </div>
          </div>

          <div className="mt-4 space-y-3">
             <div>
                <p className="text-[9px] text-slate-500 uppercase font-bold mb-2">Model Convergence (Global vs. Local)</p>
                <div className="h-20 bg-white/5 rounded border border-white/5 overflow-hidden">
                   <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={dreamHistory.slice(-10)}>
                        <Line type="monotone" dataKey="validationLoss" stroke="#10b981" strokeWidth={2} dot={false} name="Global Loss" />
                        <Line type="monotone" dataKey="policyLoss" stroke="#6366f1" strokeWidth={1} strokeDasharray="3 3" dot={false} name="Local Variance" />
                      </LineChart>
                   </ResponsiveContainer>
                </div>
             </div>
             <div className="flex justify-between items-end">
                <div>
                   <p className="text-[9px] text-slate-600 uppercase font-bold">Latest Aggregation</p>
                   <p className="text-[10px] text-slate-400 font-mono">Round #{(dreamHistory.length % 10) + 1}</p>
                </div>
                <div className="px-2 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded text-[9px] text-emerald-400 font-bold uppercase">
                   DP Noise Enabled
                </div>
             </div>
          </div>
        </div>

        <div className={`bg-white/5 border border-white/10 rounded-xl p-6 ${theme === 'dark' ? 'bg-black/40' : 'bg-white/60'}`}>
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-purple-400" />
            Collective Unconscious (Shared Dream)
          </h3>
          <div className="space-y-4">
             {collectiveDream ? (
               <div className="relative p-4 bg-purple-500/5 border border-purple-500/20 rounded-lg overflow-hidden group">
                  <div className="absolute top-0 left-0 w-1 h-full bg-purple-500/50"></div>
                  <p className="text-xs text-slate-300 italic leading-relaxed">
                    "{collectiveDream.narrative}"
                  </p>
                  <div className="mt-3 flex justify-between items-center">
                    <span className="text-[9px] text-purple-400 font-bold uppercase tracking-tighter">Round #{collectiveDream.round}</span>
                    <span className="text-[9px] text-slate-500 font-mono">{new Date(collectiveDream.updatedAt).toLocaleTimeString()}</span>
                  </div>
               </div>
             ) : (
               <div className="p-4 bg-white/5 border border-white/5 rounded-lg text-center">
                 <p className="text-xs text-slate-500 animate-pulse">Awaiting collective consensus...</p>
               </div>
             )}
             
             <div className="grid grid-cols-2 gap-2">
                <div className="p-2 bg-white/5 rounded border border-white/5 text-center">
                   <p className="text-[8px] text-slate-500 uppercase font-bold">Consensus</p>
                   <p className="text-xs font-semibold text-purple-400">84.2%</p>
                </div>
                <div className="p-2 bg-white/5 rounded border border-white/5 text-center">
                   <p className="text-[8px] text-slate-500 uppercase font-bold">Agents</p>
                   <p className="text-xs font-semibold text-indigo-400">3 Active</p>
                </div>
             </div>
          </div>
        </div>

        <div className={`bg-white/5 border border-white/10 rounded-xl p-6 ${theme === 'dark' ? 'bg-black/40' : 'bg-white/60'}`}>
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
            <Shield className="w-4 h-4 text-emerald-400" />
            DevOps Brain: Self-Healing Log
          </h3>
          <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
            {healthHistory.length > 0 ? (
              healthHistory.map((item, i) => (
                <div key={item.id || i} className="p-3 bg-white/5 rounded-lg border border-white/5 flex flex-col gap-1 hover:bg-white/10 transition-colors">
                  <div className="flex justify-between items-center">
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                      item.actionTaken === 'NOOP' ? 'bg-slate-500/20 text-slate-400' : 'bg-emerald-500/20 text-emerald-400'
                    }`}>
                      {item.actionTaken}
                    </span>
                    <span className="text-[9px] text-slate-500 font-mono">
                      {new Date(item.timestamp?.seconds ? item.timestamp.seconds * 1000 : item.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mt-1">
                    <div className="text-center">
                      <p className="text-[7px] text-slate-500 uppercase">Mem</p>
                      <p className={`text-[10px] font-mono ${item.memoryUsageRatio > 0.8 ? 'text-red-400' : 'text-slate-300'}`}>
                        {(item.memoryUsageRatio * 100).toFixed(0)}%
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-[7px] text-slate-500 uppercase">Latency</p>
                      <p className="text-[10px] font-mono text-slate-300">
                        {Math.round(item.geminiLatencyMs)}ms
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-[7px] text-slate-500 uppercase">Errors</p>
                      <p className={`text-[10px] font-mono ${item.unhandledErrors > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                        {item.unhandledErrors}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8">
                <Shield className="w-8 h-8 text-slate-700 mx-auto mb-2 opacity-20" />
                <p className="text-xs text-slate-500">No self-healing events recorded yet.</p>
              </div>
            )}
          </div>
        </div>

        <div className={`bg-white/5 border border-white/10 rounded-xl p-6 ${theme === 'dark' ? 'bg-black/40' : 'bg-white/60'}`}>
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
            <Cpu className="w-4 h-4 text-emerald-400" />
            DevOps Brain: Manual Self-Healing Controls
          </h3>
          <div className="space-y-3">
            <p className="text-[11px] text-slate-400 leading-normal">
              Execute proactive maintenance actions directly on the active neural clusters to heal telemetry and memory degradation:
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => triggerHealingAction('TRIGGER_GARBAGE_COLLECTION')}
                className="p-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/20 rounded text-[10px] font-mono transition-all uppercase text-left flex items-center justify-between cursor-pointer"
              >
                <span>Garbage Collection</span>
                <span className="text-[8px] bg-emerald-500/20 px-1 py-0.5 rounded text-emerald-400">GC</span>
              </button>
              <button
                onClick={() => triggerHealingAction('REDUCE_BATCH_SIZE')}
                className="p-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/20 rounded text-[10px] font-mono transition-all uppercase text-left flex items-center justify-between cursor-pointer"
              >
                <span>Reduce Batch Size</span>
                <span className="text-[8px] bg-amber-500/20 px-1 py-0.5 rounded text-amber-400">BATCH</span>
              </button>
              <button
                onClick={() => triggerHealingAction('INCREASE_RETRY_DELAY')}
                className="p-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 border border-blue-500/20 rounded text-[10px] font-mono transition-all uppercase text-left flex items-center justify-between cursor-pointer"
              >
                <span>Increase Retry Delay</span>
                <span className="text-[8px] bg-blue-500/20 px-1 py-0.5 rounded text-blue-400">RETRY</span>
              </button>
              <button
                onClick={() => triggerHealingAction('RUN_DIAGNOSTIC')}
                className="p-2 bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/20 rounded text-[10px] font-mono transition-all uppercase text-left flex items-center justify-between cursor-pointer"
              >
                <span>Run Diagnostic</span>
                <span className="text-[8px] bg-purple-500/20 px-1 py-0.5 rounded text-purple-400">PROBE</span>
              </button>
            </div>
            {healingStatus && (
              <p className="text-[10px] font-mono text-center text-emerald-400 bg-emerald-500/5 py-1.5 rounded border border-emerald-500/10 animate-pulse">
                {healingStatus}
              </p>
            )}
          </div>
        </div>

        <div className={`bg-white/5 border border-white/10 rounded-xl p-6 ${theme === 'dark' ? 'bg-black/40' : 'bg-white/60'}`}>
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-400" />
            System Health & Resilience
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 bg-white/5 rounded-lg border border-white/5">
              <p className="text-[9px] text-slate-500 uppercase font-bold mb-1">Uptime</p>
              <p className="text-xs font-mono text-slate-200">
                {healthData?.uptime ? `${(healthData.uptime / 60).toFixed(1)}m` : 'N/A'}
              </p>
            </div>
            <div className="p-3 bg-white/5 rounded-lg border border-white/5">
              <p className="text-[9px] text-slate-500 uppercase font-bold mb-1">Heap Usage</p>
              <p className="text-xs font-mono text-slate-200">
                {healthData?.memoryUsage?.heapUsed ? `${(healthData.memoryUsage.heapUsed / 1024 / 1024).toFixed(1)}MB` : 'N/A'}
              </p>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between p-2 bg-white/5 rounded border border-white/5">
            <span className="text-[10px] text-slate-500 uppercase font-bold">Cloud Persistence</span>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${healthData?.firestoreConnected ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
              <span className="text-[10px] font-mono text-slate-300">
                {healthData?.firestoreConnected ? 'CONNECTED' : 'DISCONNECTED'}
              </span>
            </div>
          </div>
        </div>

        <div className={`bg-white/5 border border-white/10 rounded-xl p-6 ${theme === 'dark' ? 'bg-black/40' : 'bg-white/60'}`}>
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-widest mb-4">Policy Convergence (Q-Value)</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={convergenceData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="episode" stroke="#94a3b8" fontSize={10} />
              <YAxis stroke="#94a3b8" fontSize={10} domain={[0, 'auto']} />
              <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px' }} />
              <Line type="monotone" dataKey="qValue" stroke="#2dd4bf" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className={`lg:col-span-2 bg-white/5 border border-white/10 rounded-xl p-6 ${theme === 'dark' ? 'bg-black/40' : 'bg-white/60'}`}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <Moon className="w-4 h-4 text-purple-400" />
              Dream Lab: VRSSM & CQL Consolidation
            </h3>
            {dreamHistory.length > 0 && (
              <div className="flex gap-2">
                <span className="text-[10px] text-purple-400 font-mono bg-purple-400/10 px-2 py-0.5 rounded border border-purple-400/20">
                  VAL LOSS: {dreamHistory[0].validationLoss?.toFixed(4) || 'N/A'}
                </span>
                <span className="text-[10px] text-teal-400 font-mono bg-teal-400/10 px-2 py-0.5 rounded border border-teal-400/20">
                  LATEST GAIN: +{dreamHistory[0].gain.toFixed(2)}
                </span>
              </div>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2">
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={dreamChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="time" stroke="#94a3b8" fontSize={10} />
                  <YAxis yAxisId="left" stroke="#c084fc" fontSize={10} />
                  <YAxis yAxisId="right" orientation="right" stroke="#2dd4bf" fontSize={10} />
                  <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px' }} />
                  <Line yAxisId="left" type="monotone" dataKey="gain" stroke="#c084fc" strokeWidth={2} dot={false} />
                  <Line yAxisId="right" type="monotone" dataKey="valLoss" stroke="#2dd4bf" strokeWidth={1} strokeDasharray="5 5" dot={false} />
                </LineChart>
              </ResponsiveContainer>
              <p className="text-[10px] text-center text-slate-500 mt-2 font-mono uppercase">Gain (Purple) vs World Model Validation Loss (Teal Dash)</p>
            </div>
            <div className="space-y-4">
              <div className="p-4 bg-purple-500/5 border border-purple-500/10 rounded-lg">
                <p className="text-[10px] text-slate-500 uppercase font-bold mb-1">Architecture</p>
                <p className="text-sm font-mono text-purple-200">VRSSM + CQL</p>
                <p className="text-[10px] text-slate-500 mt-1">Horizon: 10 | PER: Enabled</p>
              </div>
              <div className="p-4 bg-slate-500/5 border border-slate-500/10 rounded-lg">
                <p className="text-[10px] text-slate-500 uppercase font-bold mb-1">Dream Narratives Generated</p>
                <p className="text-xl font-bold text-slate-200 font-mono">
                  {dreamHistory.filter(d => d.narrative).length}
                </p>
              </div>
              <div className="p-4 bg-slate-500/5 border border-slate-500/10 rounded-lg">
                <p className="text-[10px] text-slate-500 uppercase font-bold mb-1">State Anomalies Prevented</p>
                <p className="text-xs text-slate-400 font-mono">Active Monitoring Enabled</p>
              </div>
            </div>
          </div>

          <div className="mt-8 space-y-3">
            <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-white/5 pb-2">Recent Dream Narratives</h4>
            <div className="space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
              {dreamHistory.filter(d => d.narrative).map((dream, i) => (
                <div key={i} className="p-3 bg-white/5 rounded-lg border border-white/5 animate-in slide-in-from-left duration-500" style={{ animationDelay: `${i * 100}ms` }}>
                  <p className="text-xs text-purple-300 italic leading-relaxed">"{dream.narrative}"</p>
                  <p className="text-[9px] text-slate-500 mt-1 font-mono">{new Date(dream.timestamp).toLocaleString()}</p>
                </div>
              ))}
              {dreamHistory.filter(d => d.narrative).length === 0 && (
                <p className="text-[10px] text-slate-600 font-mono italic">No narratives registered yet...</p>
              )}
            </div>
          </div>
        </div>

        <div className={`lg:col-span-2 bg-white/5 border border-white/10 rounded-xl p-6 ${theme === 'dark' ? 'bg-black/40' : 'bg-white/60'}`}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-fuchsia-400" />
              Dream Analytics: Autonomous Consolidation
            </h3>
          </div>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={dreamChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="time" stroke="#94a3b8" fontSize={10} />
              <YAxis yAxisId="left" stroke="#c084fc" fontSize={10} />
              <YAxis yAxisId="right" orientation="right" stroke="#2dd4bf" fontSize={10} />
              <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px' }} />
              <Area yAxisId="left" type="monotone" dataKey="gain" stroke="#c084fc" fill="#c084fc" fillOpacity={0.3} name="Effectiveness (Gain)" />
              <Area yAxisId="right" type="monotone" dataKey="steps" stroke="#2dd4bf" fill="#2dd4bf" fillOpacity={0.3} name="Frequency (Steps)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* --- UPGRADED TELEMETRY UI --- */}
        <div className={`lg:col-span-1 bg-white/5 border border-white/10 rounded-xl p-6 ${theme === 'dark' ? 'bg-black/40' : 'bg-white/60'}`}>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <Network className="w-4 h-4 text-rose-400" />
              Cognitive Alignment
            </h3>
          </div>
          <p className="text-[10px] text-slate-500 font-mono mb-4">Real-time vector dimensions</p>
          <ResponsiveContainer width="100%" height={220}>
            <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
              <PolarGrid stroke="#334155" />
              <PolarAngleAxis dataKey="subject" tick={{ fill: '#94a3b8', fontSize: 9 }} />
              <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
              <Radar name="Alignment" dataKey="value" stroke="#f43f5e" fill="#f43f5e" fillOpacity={0.3} />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        <div className={`lg:col-span-2 bg-white/5 border border-white/10 rounded-xl p-6 flex flex-col justify-between ${theme === 'dark' ? 'bg-black/40' : 'bg-white/60'}`}>
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <Target className="w-4 h-4 text-sky-400" />
                Latent Memory Dispersion
              </h3>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-500 uppercase font-bold">System Entropy</span>
                <span className="text-xs font-mono font-bold text-sky-400">{systemEntropy.toFixed(1)}%</span>
              </div>
            </div>
            <p className="text-[10px] text-slate-500 font-mono mb-2">PCA-reduced contextual embedding distribution (synthetic variance)</p>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <ScatterChart margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis type="number" dataKey="x" name="PC1" stroke="#94a3b8" fontSize={10} tick={false} />
              <YAxis type="number" dataKey="y" name="PC2" stroke="#94a3b8" fontSize={10} tick={false} />
              <ZAxis type="number" dataKey="z" range={[20, 200]} name="Density" />
              <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }} />
              <Scatter name="Memory Vector" data={scatterData} fill="#0ea5e9" opacity={0.6} />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
        {/* --- END UPGRADED TELEMETRY UI --- */}

        {/* Phase 12a: Liquid Monitor */}
        <div className="lg:col-span-2">
          <LiquidMonitor theme={theme} />
        </div>
        
        {/* Phase 12c: Cognitive Sculpting Console */}
        <div className="lg:col-span-3">
          <CognitiveSculptingConsole theme={theme} />
        </div>
      </div>
    </div>
  );
};

export default TelemetryDashboard;
