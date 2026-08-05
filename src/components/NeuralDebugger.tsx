import { useState, useEffect } from 'react';
import { getFirestore, collection, query, orderBy, limit, onSnapshot, doc, isQuotaExceeded, setQuotaExceeded } from '../firebase.js';
import { useAuth } from '../hooks/useAuth.js';
import { fetchWithTracing } from '../lib/fetchWithTracing.js';
import { 
  Database, 
  Activity, 
  Cpu, 
  Zap, 
  AlertTriangle, 
  Search, 
  RefreshCw, 
  Play, 
  ShieldAlert, 
  Terminal, 
  ChevronRight, 
  AlertCircle, 
  Sparkles, 
  Server, 
  Check, 
  X 
} from 'lucide-react';

export function NeuralDebugger() {
  const { user } = useAuth();
  const [traceId, setTraceId] = useState('');
  const [traceData, setTraceData] = useState<any>(null);
  const [aggregateId, setAggregateId] = useState('dream-cycle');
  const [events, setEvents] = useState<any[]>([]);
  const [currentState, setCurrentState] = useState<any>(null);
  const [breakerStatus, setBreakerStatus] = useState<any>({});
  const [anomalyData, setAnomalyData] = useState<any[]>([]);
  const [diagnosing, setDiagnosing] = useState(false);
  const [diagnosticsResult, setDiagnosticsResult] = useState<any>(null);

  const [clientQuotaExceeded, setClientQuotaExceededState] = useState(isQuotaExceeded);
  const [serverQuotaExceeded, setServerQuotaExceededState] = useState(false);
  const [resettingQuota, setResettingQuota] = useState(false);
  const [quotaMessage, setQuotaMessage] = useState<string | null>(null);

  const checkServerQuotaStatus = async () => {
    try {
      const res = await fetch('/api/debug/quota-status');
      const data = await res.json();
      setServerQuotaExceededState(!!data.isServerQuotaExceeded);
    } catch (e) {
      console.error("Failed to check server quota status:", e);
    }
  };

  const handleResetQuota = async () => {
    setResettingQuota(true);
    setQuotaMessage(null);
    try {
      await fetch('/api/debug/reset-quota', { method: 'POST' });
      setQuotaExceeded(false);
      setClientQuotaExceededState(false);
      setServerQuotaExceededState(false);
      setQuotaMessage("Successfully reset! Reconnecting with active Firestore...");
    } catch (e: any) {
      setQuotaMessage("Reset failed: " + e.message);
    } finally {
      setResettingQuota(false);
    }
  };

  useEffect(() => {
    checkServerQuotaStatus();
  }, []);

  useEffect(() => {
    if (!user) return;
    const db = getFirestore();
    const unsub = onSnapshot(doc(db, `users/${user.uid}/circuitBreakers/gemini`), (snap) => {
      if (snap.exists()) setBreakerStatus(snap.data());
    });
    return () => unsub();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const db = getFirestore();
    const q = query(
      collection(db, `users/${user.uid}/eventLog`),
      orderBy('timestamp', 'desc'),
      limit(10)
    );
    const unsub = onSnapshot(q, (snap) => {
      const items = snap.docs.map((d: any) => d.data());
      setAnomalyData(items.filter((i: any) => i.eventType === 'ANOMALY_DETECTED'));
    });
    return () => unsub();
  }, [user]);

  const runDiagnostics = async () => {
    setDiagnosing(true);
    setDiagnosticsResult(null);
    try {
      const res = await fetch('/api/debug/pipeline-diagnostics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user?.uid })
      });
      const data = await res.json();
      setDiagnosticsResult(data);
    } catch (e: any) {
      setDiagnosticsResult({
        success: false,
        steps: [
          { step: "Diagnostics Invocation", status: "FAILED", latencyMs: 0, error: e.message }
        ],
        verdict: "DIAGNOSTICS SUITE CRITICAL FAILURE."
      });
    } finally {
      setDiagnosing(false);
      checkServerQuotaStatus();
      setClientQuotaExceededState(isQuotaExceeded);
    }
  };

  const loadTrace = async () => {
    try {
      const res = await fetchWithTracing(`/api/debug/trace?traceId=${traceId}`);
      const data = await res.json();
      setTraceData(data);
    } catch (error) {
      console.error("Failed to load trace:", error);
    }
  };

  const loadEvents = async () => {
    try {
      const res = await fetch('/api/debug/replay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user?.uid, aggregateId }),
      });
      const data = await res.json();
      setEvents(data.events || []);
    } catch (error) {
      console.error("Failed to load events:", error);
    }
  };

  const replayToEvent = async (eventId: string) => {
    try {
      const res = await fetch('/api/debug/replay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user?.uid, aggregateId, upToEventId: eventId }),
      });
      const data = await res.json();
      setCurrentState(data.finalState);
    } catch (error) {
      console.error("Failed to replay event:", error);
    }
  };

  return (
    <div className="p-6 space-y-6 max-h-[calc(100vh-100px)] overflow-y-auto custom-scrollbar">
      {/* Heading */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Cpu className="w-6 h-6 text-purple-400" />
            <h2 className="text-2xl font-bold font-sans text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-indigo-400 to-pink-400 tracking-tight">
              Neural Debugger & Circuit Tracer
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl font-sans leading-relaxed">
            Diagnose active synaptic routers, trace latency-sensitive execution events, monitor the Gemini circuit breaker, replay telemetry states, and review persistence safety shims.
          </p>
        </div>
        <div className="flex items-center gap-2 self-start md:self-center">
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
          </span>
          <span className="text-[10px] uppercase font-mono tracking-widest text-slate-500">
            Node Debug Active
          </span>
        </div>
      </div>

      {/* Top Grid: Quotas & System Status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Firestore Quota Fallback and Offline System Status */}
        <div className="bg-[#101017]/60 border border-white/5 p-5 rounded-2xl shadow-xl space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold font-sans text-amber-300 flex items-center gap-2 uppercase tracking-wider">
                <Database className="w-4 h-4 text-amber-400" /> Quota & Persistence Shim
              </h3>
              <span className={`text-[9px] font-mono font-bold tracking-widest px-2.5 py-0.5 rounded-full border ${
                clientQuotaExceeded || serverQuotaExceeded
                  ? 'text-amber-400 bg-amber-950/40 border-amber-500/20'
                  : 'text-emerald-400 bg-emerald-950/40 border-emerald-500/20'
              }`}>
                {clientQuotaExceeded || serverQuotaExceeded ? 'FALLBACK ACTIVE' : 'LIVE DB SYNCED'}
              </span>
            </div>
            
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              Resilient dual-layer persistence system: switches dynamically to LocalStorage and server memory shims if Firestore's free tier quotas are exhausted.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
              <div className="bg-black/40 border border-white/5 p-3 rounded-xl flex items-center justify-between">
                <span className="text-[11px] text-slate-400 flex items-center gap-1.5 font-mono">
                  <Server className="w-3.5 h-3.5 text-slate-500" /> Client DB
                </span>
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${clientQuotaExceeded ? 'bg-red-950/60 text-red-400 border border-red-500/20' : 'bg-emerald-950/60 text-emerald-400 border border-emerald-500/20'}`}>
                  {clientQuotaExceeded ? 'OFFLINE' : 'ONLINE'}
                </span>
              </div>
              <div className="bg-black/40 border border-white/5 p-3 rounded-xl flex items-center justify-between">
                <span className="text-[11px] text-slate-400 flex items-center gap-1.5 font-mono">
                  <Server className="w-3.5 h-3.5 text-slate-500" /> Server DB
                </span>
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${serverQuotaExceeded ? 'bg-red-950/60 text-red-400 border border-red-500/20' : 'bg-emerald-950/60 text-emerald-400 border border-emerald-500/20'}`}>
                  {serverQuotaExceeded ? 'OFFLINE' : 'ONLINE'}
                </span>
              </div>
            </div>

            {(clientQuotaExceeded || serverQuotaExceeded) && (
              <div className="mt-3 p-3 bg-amber-950/20 border border-amber-500/15 rounded-xl text-[11px] text-amber-200/90 leading-relaxed font-sans space-y-1.5">
                <p className="font-bold flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-400" /> Firestore daily quota exceeded.
                </p>
                <p>
                  To restore live synchronization and verify database state, please check your Firebase Console:
                </p>
                <div>
                  <a 
                    href="https://console.firebase.google.com/project/gen-lang-client-0894146864/firestore/databases/ai-studio-arcanequantumbra-231b2d9b-0b8c-44b2-ba57-6ffc18932d34/data?openUpgradeDialog=true"
                    target="_blank" 
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-indigo-400 hover:text-indigo-300 font-semibold cursor-pointer font-mono text-[10px]"
                  >
                    Launch Firebase Dashboard ↗
                  </a>
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2 items-center pt-2">
            <button
              onClick={handleResetQuota}
              disabled={resettingQuota}
              className={`px-4 py-2 rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all duration-200 flex items-center gap-1.5 ${
                resettingQuota
                  ? 'bg-amber-950/60 text-amber-400 cursor-not-allowed border border-amber-500/10'
                  : 'bg-amber-600 hover:bg-amber-500 text-black active:scale-95 cursor-pointer'
              }`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${resettingQuota ? 'animate-spin' : ''}`} />
              {resettingQuota ? 'Resetting Fallback...' : 'Reset Fallback State'}
            </button>
            
            <button
              onClick={checkServerQuotaStatus}
              className="px-4 py-2 bg-white/5 hover:bg-white/10 text-slate-300 rounded-xl font-bold text-[10px] uppercase tracking-widest border border-white/5 transition-all cursor-pointer active:scale-95 flex items-center gap-1.5"
            >
              <Activity className="w-3.5 h-3.5 text-indigo-400" /> Check Quotas
            </button>

            {quotaMessage && (
              <span className="text-[10px] text-emerald-400 font-mono animate-pulse w-full sm:w-auto mt-1 sm:mt-0">{quotaMessage}</span>
            )}
          </div>
        </div>

        {/* Circuit Breaker & Anomaly Monitor */}
        <div className="bg-[#101017]/60 border border-white/5 p-5 rounded-2xl shadow-xl flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-white/5 pb-2">
              <h3 className="text-sm font-bold font-sans text-purple-300 flex items-center gap-2 uppercase tracking-wider">
                <Zap className="w-4 h-4 text-purple-400" /> Circuit Breakers & Anomalies
              </h3>
              <span className={`text-[9px] font-mono font-bold tracking-widest px-2.5 py-0.5 rounded-full border ${
                breakerStatus.state === 'OPEN'
                  ? 'text-red-400 bg-red-950/40 border-red-500/20'
                  : 'text-emerald-400 bg-emerald-950/40 border-emerald-500/20'
              }`}>
                {breakerStatus.state || 'CLOSED'}
              </span>
            </div>

            {/* Circuit stats */}
            <div className="bg-black/30 p-3 rounded-xl border border-white/5 flex items-center justify-between font-mono text-xs">
              <div className="flex items-center gap-2">
                <span className="text-slate-400">Model Node Failure Count:</span>
                <span className="text-purple-300 font-bold">{breakerStatus.failureCount || 0}</span>
              </div>
              <div className="text-[10px] text-slate-500">
                Threshold: 5 failures
              </div>
            </div>

            {/* Anomalies List */}
            <div className="space-y-2">
              <h4 className="text-[10px] font-mono uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5 text-red-400" /> Anomaly Detection Log
              </h4>
              <div className="bg-black/40 border border-white/5 rounded-xl p-3 max-h-[110px] overflow-y-auto custom-scrollbar font-mono text-[11px] space-y-2">
                {anomalyData.length > 0 ? (
                  anomalyData.map((a, idx) => (
                    <div key={idx} className="text-red-400 border-b border-white/5 pb-1 last:border-0 flex justify-between gap-2">
                      <span className="truncate flex-1">⚠️ {a.payload?.anomalies?.join(', ') || 'Synaptic anomaly detected'}</span>
                      <span className="text-[10px] text-slate-600 self-center">
                        {a.timestamp ? new Date(a.timestamp._seconds * 1000).toLocaleTimeString() : ''}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-slate-500 italic text-center py-2 text-xs">Zero anomalies logged in active epoch.</p>
                )}
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Full Width Section: Cognitive Pipeline Diagnostics */}
      <section className="bg-[#101017]/60 border border-white/5 p-5 rounded-2xl shadow-xl relative overflow-hidden space-y-4">
        <div className="absolute top-0 right-0 p-4">
          <span className="text-[9px] font-mono font-bold tracking-widest text-purple-400 bg-purple-950/40 px-2.5 py-1 rounded-full border border-purple-500/10">
            PROBE CONSOLE
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-indigo-400 animate-pulse" />
          <h3 className="text-base font-bold font-sans text-slate-200">
            Cognitive Pipeline Diagnostic Tracer
          </h3>
        </div>
        <p className="text-xs text-slate-400 max-w-3xl leading-relaxed">
          Initiate a diagnostic quantum pulse traversing all logical layers. This audits external API integrations, checks runtime credentials, mocks LLM cognitive router loops, and evaluates state structures.
        </p>

        <div className="flex gap-3">
          <button
            onClick={runDiagnostics}
            disabled={diagnosing}
            className={`px-5 py-2.5 rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all duration-300 shadow-lg flex items-center gap-2 ${
              diagnosing
                ? 'bg-purple-950/60 text-purple-400 cursor-not-allowed border border-purple-500/20'
                : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white active:scale-95 cursor-pointer shadow-purple-500/10'
            }`}
          >
            {diagnosing ? (
              <>
                <svg className="animate-spin h-3.5 w-3.5 text-purple-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Pulsing Synapses...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5 text-white" />
                <span>Run Pipeline Diagnostic Test</span>
              </>
            )}
          </button>
        </div>

        {diagnosticsResult && (
          <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
            {/* Verdict Box */}
            <div className={`p-4 rounded-xl border flex items-center justify-between gap-4 ${
              diagnosticsResult.success 
                ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300' 
                : 'bg-red-950/40 border-red-500/30 text-red-300'
            }`}>
              <div className="flex items-center gap-2.5">
                <span className="text-xl">{diagnosticsResult.success ? '✓' : '✗'}</span>
                <div>
                  <h4 className="text-xs font-bold font-sans uppercase tracking-wider">Tracer Diagnostics Outcome</h4>
                  <p className="font-mono text-[10px] opacity-80 mt-0.5 uppercase tracking-widest">
                    VERDICT: {diagnosticsResult.verdict}
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-mono text-slate-500">Epoch Timestamped</span>
            </div>

            {/* Steps Log */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[350px] overflow-y-auto custom-scrollbar pr-1">
              {diagnosticsResult.steps?.map((step: any, idx: number) => (
                <div key={idx} className="bg-black/30 p-3 rounded-xl border border-white/5 flex flex-col justify-between gap-2.5 hover:bg-black/50 transition-colors">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span>
                        {step.status === 'SUCCESS' ? (
                          <Check className="w-4 h-4 text-emerald-400" />
                        ) : step.status === 'FAILED' ? (
                          <X className="w-4 h-4 text-red-400" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 text-amber-400" />
                        )}
                      </span>
                      <div className="text-[11px] font-bold text-slate-200 uppercase tracking-wide font-sans">{step.step}</div>
                    </div>
                    {step.error && (
                      <div className="text-[10px] text-red-400 font-mono leading-relaxed bg-red-950/30 border border-red-500/10 px-2 py-1 rounded">
                        {step.error}
                      </div>
                    )}
                    {step.payload && (
                      <pre className="text-[9px] text-slate-400 font-mono leading-relaxed bg-black/50 p-2 rounded max-w-full overflow-x-auto border border-white/5">
                        {JSON.stringify(step.payload, null, 2)}
                      </pre>
                    )}
                  </div>
                  <div className="flex items-center justify-between font-mono text-[9px] text-slate-500 border-t border-white/5 pt-1.5 mt-1">
                    <span className="uppercase">{step.status}</span>
                    <span>{step.latencyMs}ms latency</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Bottom Grid: Trace Viewer & Event Replay */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Trace Viewer */}
        <section className="bg-[#101017]/60 border border-white/5 p-5 rounded-2xl shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-white/5 pb-2">
            <h3 className="text-sm font-bold font-sans text-indigo-300 flex items-center gap-2 uppercase tracking-wider">
              <Search className="w-4 h-4 text-indigo-400" /> Trace Viewer & Auditing
            </h3>
            <span className="text-[9px] font-mono text-slate-500 uppercase tracking-widest">Latency Inspector</span>
          </div>
          
          <p className="text-xs text-slate-400 leading-relaxed">
            Query detailed timing logs and internal data payloads passed through any server-side route during execution traces.
          </p>

          <div className="flex gap-2">
            <input
              type="text"
              value={traceId}
              onChange={e => setTraceId(e.target.value)}
              placeholder="Enter active Trace UUID..."
              className="bg-black/40 border border-white/5 p-2.5 px-3 rounded-xl flex-1 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500/50 font-mono"
            />
            <button 
              onClick={loadTrace} 
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs uppercase tracking-widest px-4 rounded-xl transition-all active:scale-95 cursor-pointer"
            >
              Load Trace
            </button>
          </div>

          {traceData ? (
            <div className="space-y-2">
              <h4 className="text-[10px] font-mono uppercase tracking-widest text-slate-400">Trace Inspection Payload</h4>
              <pre className="bg-black/50 p-4 border border-white/5 rounded-xl text-[10px] text-slate-300 overflow-auto max-h-[220px] font-mono leading-relaxed">
                {JSON.stringify(traceData, null, 2)}
              </pre>
            </div>
          ) : (
            <div className="border border-dashed border-white/5 rounded-xl p-6 text-center text-xs text-slate-600 italic">
              No Trace ID evaluated. Submit queries across endpoints to generate live traces.
            </div>
          )}
        </section>

        {/* Event Replay Console */}
        <section className="bg-[#101017]/60 border border-white/5 p-5 rounded-2xl shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-white/5 pb-2">
            <h3 className="text-sm font-bold font-sans text-pink-300 flex items-center gap-2 uppercase tracking-wider">
              <Terminal className="w-4 h-4 text-pink-400" /> Event Replay & Projections
            </h3>
            <span className="text-[9px] font-mono text-slate-500 uppercase tracking-widest">Time-Travel Engine</span>
          </div>

          <p className="text-xs text-slate-400 leading-relaxed">
            Select any aggregate domain and replay historical events back to specific neural event milestones. This projects state mutations in real-time.
          </p>

          <div className="flex gap-2">
            <select 
              value={aggregateId} 
              onChange={e => setAggregateId(e.target.value)} 
              className="bg-black/40 border border-white/5 p-2.5 px-3 rounded-xl flex-1 text-xs text-slate-200 focus:outline-none focus:border-pink-500/50 font-mono"
            >
              <option value="dream-cycle">Dream Cycle</option>
              <option value="rl-agent">RL Agent</option>
              <option value="debate">Debate</option>
              <option value="system-health">System Health</option>
            </select>
            <button 
              onClick={loadEvents} 
              className="bg-pink-600 hover:bg-pink-500 text-white font-bold text-xs uppercase tracking-widest px-4 rounded-xl transition-all active:scale-95 cursor-pointer flex items-center gap-1"
            >
              <Play className="w-3.5 h-3.5" /> Replay
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-[240px]">
            {/* Event List */}
            <div className="overflow-y-auto custom-scrollbar border border-white/5 rounded-xl p-2 bg-black/40 space-y-1.5">
              <div className="text-[9px] font-mono text-slate-500 uppercase tracking-wider border-b border-white/5 pb-1 px-1 mb-1">
                Event Log History
              </div>
              {events.length > 0 ? (
                events.map((e: any) => (
                  <div
                    key={e.eventId}
                    onClick={() => replayToEvent(e.eventId)}
                    className="p-2 bg-white/5 rounded-lg border border-white/5 cursor-pointer hover:bg-pink-950/20 hover:border-pink-500/20 transition-all flex flex-col gap-0.5 group"
                  >
                    <div className="text-[11px] font-mono font-bold text-slate-300 group-hover:text-pink-400 transition-colors truncate flex items-center gap-1">
                      <ChevronRight className="w-3 h-3 text-slate-500 group-hover:text-pink-500" /> {e.eventType}
                    </div>
                    <div className="text-[9px] text-slate-500 font-mono pl-4">
                      {e.timestamp ? new Date(e.timestamp._seconds * 1000).toLocaleTimeString() : ''}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-[10px] text-slate-600 italic text-center py-8 font-sans">
                  Click 'Replay' to stream aggregate events.
                </div>
              )}
            </div>

            {/* Projected State */}
            <div className="flex flex-col border border-white/5 rounded-xl p-3 bg-black/50">
              <div className="text-[9px] font-mono text-slate-500 uppercase tracking-wider border-b border-white/5 pb-1 mb-2">
                Projected State Output
              </div>
              <pre className="text-[10px] text-emerald-400 font-mono overflow-auto flex-1 leading-relaxed">
                {currentState ? JSON.stringify(currentState, null, 2) : "Select an event to calculate projected state mutations..."}
              </pre>
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}
