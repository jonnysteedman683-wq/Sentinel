import { useState, useEffect } from 'react';
import { getFirestore, collection, query, orderBy, limit, onSnapshot, doc, isQuotaExceeded, setQuotaExceeded } from '../firebase.js';
import { useAuth } from '../hooks/useAuth.js';
import { fetchWithTracing } from '../lib/fetchWithTracing.js';

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
      collection(db, `users/${user.uid}/systemHealth/eventLog`),
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
    const res = await fetchWithTracing(`/api/debug/trace?traceId=${traceId}`);
    const data = await res.json();
    setTraceData(data);
  };

  const loadEvents = async () => {
    const res = await fetch('/api/debug/replay', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user?.uid, aggregateId }),
    });
    const data = await res.json();
    setEvents(data.events || []);
  };

  const replayToEvent = async (eventId: string) => {
    const res = await fetch('/api/debug/replay', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user?.uid, aggregateId, upToEventId: eventId }),
    });
    const data = await res.json();
    setCurrentState(data.finalState);
  };

  return (
    <div className="p-4 space-y-6">
      <h2 className="text-2xl font-bold text-purple-400 font-sans tracking-tight">Neural Debugger</h2>

      {/* Firestore Quota Fallback and Offline System Status */}
      <section className="bg-slate-900 border border-amber-500/20 p-5 rounded-2xl shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 p-3">
          <span className={`text-[9px] font-mono font-bold tracking-widest px-2 py-1 rounded-full border ${
            clientQuotaExceeded || serverQuotaExceeded
              ? 'text-amber-400 bg-amber-950/40 border-amber-500/20'
              : 'text-emerald-400 bg-emerald-950/40 border-emerald-500/20'
          }`}>
            {clientQuotaExceeded || serverQuotaExceeded ? 'OFFLINE FALLBACK ACTIVATED' : 'LIVE DB SYNCED'}
          </span>
        </div>
        
        <h3 className="text-lg font-bold font-sans text-amber-100 flex items-center gap-2">
          🗄️ Firestore Quota & Persistence Fallback
        </h3>
        
        <p className="text-xs text-gray-400 mt-1 max-w-2xl font-sans">
          The Arcane Quantum Brain uses a dual-layer high-resilience shim (Local Storage on client, In-Memory DB on server) to guarantee zero downtime even if Firestore's Spark Plan free daily write limits are exhausted.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <div className="bg-slate-950/40 border border-white/5 p-3 rounded-xl flex items-center justify-between">
            <span className="text-xs text-gray-300 font-sans">Client-Side Quota State</span>
            <span className={`text-xs font-mono px-2 py-0.5 rounded font-bold ${clientQuotaExceeded ? 'bg-red-950 text-red-400' : 'bg-green-950 text-green-400'}`}>
              {clientQuotaExceeded ? 'EXHAUSTED (Offline)' : 'HEALTHY (Synced)'}
            </span>
          </div>
          <div className="bg-slate-950/40 border border-white/5 p-3 rounded-xl flex items-center justify-between">
            <span className="text-xs text-gray-300 font-sans">Server-Side Quota State</span>
            <span className={`text-xs font-mono px-2 py-0.5 rounded font-bold ${serverQuotaExceeded ? 'bg-red-950 text-red-400' : 'bg-green-950 text-green-400'}`}>
              {serverQuotaExceeded ? 'EXHAUSTED (In-Memory)' : 'HEALTHY (Synced)'}
            </span>
          </div>
        </div>

        {(clientQuotaExceeded || serverQuotaExceeded) && (
          <div className="mt-4 p-3 bg-amber-950/20 border border-amber-500/20 rounded-xl text-xs text-amber-300 leading-relaxed font-sans">
            <p className="font-bold mb-1">🚨 Daily Quota Exceeded Detected</p>
            <p>
              Your Firebase Firestore project is currently hitting its Spark Plan free daily limit. To upgrade your limits or verify your database state, visit the Firebase Console:
            </p>
            <div className="mt-2">
              <a 
                href="https://console.firebase.google.com/project/gen-lang-client-0894146864/firestore/databases/ai-studio-arcanequantumbra-231b2d9b-0b8c-44b2-ba57-6ffc18932d34/data?openUpgradeDialog=true"
                target="_blank" 
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-purple-400 hover:text-purple-300 underline font-semibold cursor-pointer"
              >
                Go to Firebase Console Firestore Dashboard ↗
              </a>
            </div>
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-3 items-center">
          <button
            onClick={handleResetQuota}
            disabled={resettingQuota}
            className={`px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-wider transition-all duration-300 ${
              resettingQuota
                ? 'bg-amber-950 text-amber-400 cursor-not-allowed border border-amber-500/20'
                : 'bg-amber-600 hover:bg-amber-500 text-slate-950 cursor-pointer active:scale-95'
            }`}
          >
            {resettingQuota ? 'Resetting Fallback...' : 'Reset Quota & Try Reconnecting'}
          </button>
          
          <button
            onClick={checkServerQuotaStatus}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-gray-300 rounded-xl font-bold text-xs uppercase tracking-wider transition-all cursor-pointer active:scale-95"
          >
            Refresh Status
          </button>

          {quotaMessage && (
            <span className="text-xs text-emerald-400 font-mono animate-pulse">{quotaMessage}</span>
          )}
        </div>
      </section>

      {/* Cognitive Pipeline Diagnostic Tracer */}
      <section className="bg-gray-900 border border-purple-500/20 p-5 rounded-2xl shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 p-3">
          <span className="text-[9px] font-mono font-bold tracking-widest text-purple-400 bg-purple-950/40 px-2 py-1 rounded-full border border-purple-500/10">
            DIAGNOSTIC PROBE ACTIVE
          </span>
        </div>
        <h3 className="text-lg font-bold font-sans text-purple-100 flex items-center gap-2">
          🧠 Cognitive Pipeline Diagnostic Tracer
        </h3>
        <p className="text-xs text-gray-400 mt-1 max-w-2xl font-sans">
          This tracing engine initiates a real-time probe across all layers of the AQB framework. It validates API keys, mocks cognitive routers, triggers low-latency connectivity queries, and analyzes schemas to pinpoint failure vectors.
        </p>

        <div className="mt-4 flex gap-3">
          <button
            onClick={runDiagnostics}
            disabled={diagnosing}
            className={`px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all duration-300 shadow ${
              diagnosing
                ? 'bg-purple-950 text-purple-400 cursor-not-allowed border border-purple-500/20'
                : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white active:scale-95 cursor-pointer'
            }`}
          >
            {diagnosing ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-3.5 w-3.5 text-purple-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Pulsing Synapses...
              </span>
            ) : 'Run Pipeline Diagnostic Test'}
          </button>
        </div>

        {diagnosticsResult && (
          <div className="mt-6 space-y-4 animate-in fade-in slide-in-from-top-3 duration-500">
            {/* Verdict Box */}
            <div className={`p-4 rounded-xl border ${
              diagnosticsResult.success 
                ? 'bg-green-950/40 border-green-500/30 text-green-300' 
                : 'bg-red-950/40 border-red-500/30 text-red-300'
            }`}>
              <div className="flex items-center gap-2">
                <span className="text-lg">{diagnosticsResult.success ? '✅' : '❌'}</span>
                <span className="font-mono text-xs font-bold uppercase tracking-widest">
                  VERDICT: {diagnosticsResult.verdict}
                </span>
              </div>
            </div>

            {/* Steps Log */}
            <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
              {diagnosticsResult.steps?.map((step: any, idx: number) => (
                <div key={idx} className="bg-slate-950/50 p-3 rounded-xl border border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-2">
                  <div className="flex items-start gap-2.5">
                    <span className="mt-0.5 select-none">
                      {step.status === 'SUCCESS' ? '✅' : step.status === 'FAILED' ? '❌' : '🔘'}
                    </span>
                    <div>
                      <div className="text-xs font-bold text-gray-200 uppercase tracking-wide">{step.step}</div>
                      {step.error && (
                        <div className="text-[10px] text-red-400 font-mono mt-0.5 leading-relaxed bg-red-950/30 border border-red-500/10 px-2 py-1 rounded">
                          {step.error}
                        </div>
                      )}
                      {step.payload && (
                        <pre className="text-[9px] text-slate-500 font-mono mt-1 leading-normal bg-black/40 p-2 rounded max-w-full overflow-x-auto">
                          {JSON.stringify(step.payload, null, 2)}
                        </pre>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 self-end md:self-center font-mono text-[10px] text-slate-400 bg-white/5 px-2 py-1 rounded">
                    <span>{step.latencyMs}ms</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
      <section className="bg-gray-900 p-4 rounded">
        <h3 className="text-lg">Trace Viewer</h3>
        <div className="flex gap-2 mt-2">
          <input
            type="text"
            value={traceId}
            onChange={e => setTraceId(e.target.value)}
            placeholder="Enter trace ID"
            className="bg-gray-800 p-2 rounded flex-1"
          />
          <button onClick={loadTrace} className="bg-blue-600 px-4 py-2 rounded">Load</button>
        </div>
        {traceData && <pre className="mt-2 text-xs overflow-auto">{JSON.stringify(traceData, null, 2)}</pre>}
      </section>
      <section className="bg-gray-900 p-4 rounded">
        <h3 className="text-lg">Circuit Breaker (Gemini)</h3>
        <div className="flex gap-4 mt-2">
          <span className={`px-3 py-1 rounded ${breakerStatus.state === 'CLOSED' ? 'bg-green-600' : breakerStatus.state === 'OPEN' ? 'bg-red-600' : 'bg-yellow-600'}`}>
            {breakerStatus.state || 'UNKNOWN'}
          </span>
          <span>Failures: {breakerStatus.failureCount || 0}</span>
        </div>
      </section>
      <section className="bg-gray-900 p-4 rounded">
        <h3 className="text-lg">Event Replay Console</h3>
        <div className="flex gap-2 mt-2">
          <select value={aggregateId} onChange={e => setAggregateId(e.target.value)} className="bg-gray-800 p-2 rounded">
            <option value="dream-cycle">Dream Cycle</option>
            <option value="rl-agent">RL Agent</option>
            <option value="debate">Debate</option>
            <option value="system-health">System Health</option>
          </select>
          <button onClick={loadEvents} className="bg-blue-600 px-4 py-2 rounded">Load Events</button>
        </div>
        <div className="flex mt-4 h-64">
          <div className="w-1/3 overflow-y-auto border-r border-gray-700 pr-2">
            {events.map((e: any) => (
              <div
                key={e.eventId}
                onClick={() => replayToEvent(e.eventId)}
                className="p-2 bg-gray-800 rounded cursor-pointer hover:bg-gray-700 mb-1"
              >
                <div className="text-sm font-mono">{e.eventType}</div>
                <div className="text-xs text-gray-400">
                  {e.timestamp ? new Date(e.timestamp._seconds * 1000).toLocaleTimeString() : ''}
                </div>
              </div>
            ))}
          </div>
          <div className="w-2/3 pl-4">
            <h4 className="text-md mb-2">Projected State</h4>
            <pre className="bg-gray-950 p-3 rounded text-xs overflow-auto h-full">
              {JSON.stringify(currentState, null, 2)}
            </pre>
          </div>
        </div>
      </section>
      <section className="bg-gray-900 p-4 rounded">
        <h3 className="text-lg">Anomaly Monitor</h3>
        {anomalyData.length > 0 ? (
          <div className="mt-2 space-y-1">
            {anomalyData.map((a, idx) => (
              <div key={idx} className="text-sm text-red-400">
                {a.timestamp ? new Date(a.timestamp._seconds * 1000).toLocaleTimeString() : ''}: {a.payload?.anomalies?.join(', ')}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500">No anomalies detected.</p>
        )}
      </section>
    </div>
  );
}
