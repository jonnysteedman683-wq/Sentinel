import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { AlertCircle, Terminal, X, ChevronRight, Activity, ShieldAlert, Cpu, Heart, CheckCircle2 } from 'lucide-react';
import { AppError, parseAPIError } from '../lib/errors.js';
import { ingestTelemetry } from '../lib/api.js';

export interface DiagnosticError {
  id: string;
  error: AppError;
  timestamp: number;
  resolved: boolean;
}

export interface SystemHealthMetrics {
  memoryUsageRatio: number;
  cpuLoad: number;
  firestoreReadErrors: number;
  firestoreWriteErrors: number;
  geminiLatencyMs: number;
  unhandledErrors: number;
  dreamCycleFailureRate: number;
}

interface ErrorContextType {
  errors: DiagnosticError[];
  isOverlayOpen: boolean;
  metrics: SystemHealthMetrics | null;
  addError: (error: unknown) => void;
  resolveError: (id: string) => void;
  clearAllErrors: () => void;
  setOverlayOpen: (open: boolean) => void;
  refreshMetrics: () => Promise<void>;
}

const ErrorContext = createContext<ErrorContextType | undefined>(undefined);

/**
 * React Context Provider for error tracking and system health telemetry.
 * Automatically hooks into unhandled global window errors and provides
 * a structured interface for manual/managed error routing.
 */
export function ErrorProvider({ children }: { children: ReactNode }) {
  const [errors, setErrors] = useState<DiagnosticError[]>([]);
  const [isOverlayOpen, setOverlayOpen] = useState(false);
  const [metrics, setMetrics] = useState<SystemHealthMetrics | null>(null);

  const addError = (errVal: unknown) => {
    const parsed = parseAPIError(errVal);
    const newErr: DiagnosticError = {
      id: `err-${Math.random().toString(36).substring(2, 9)}`,
      error: parsed,
      timestamp: Date.now(),
      resolved: false,
    };

    setErrors((prev) => [newErr, ...prev].slice(0, 50)); // limit log list to last 50
    console.error('[Cortex Diagnostics Captured]', parsed);

    // Auto-trigger telemetry for high-severity issues
    if (parsed.status >= 500) {
      ingestTelemetry({
        type: 'CLIENT_CAPTURED_API_FAILURE',
        data: {
          message: parsed.message,
          code: parsed.code,
          traceId: parsed.traceId,
          timestamp: parsed.timestamp,
        },
      }).catch(() => {});
    }
  };

  const resolveError = (id: string) => {
    setErrors((prev) =>
      prev.map((e) => (e.id === id ? { ...e, resolved: true } : e))
    );
  };

  const clearAllErrors = () => {
    setErrors([]);
  };

  const refreshMetrics = async () => {
    try {
      const res = await fetch('/api/system/health');
      if (res.ok) {
        const data = await res.json();
        setMetrics(data);
      }
    } catch (e) {
      console.warn('Failed to fetch backend system health metrics:', e);
    }
  };

  // Listen to unhandled window errors and promise rejections globally
  useEffect(() => {
    const handleErrorEvent = (event: ErrorEvent) => {
      // Prevent double tracking in development environment
      if (event.error?.message?.includes('ResizeObserver')) return;
      addError(event.error || event.message);
    };

    const handleRejectionEvent = (event: PromiseRejectionEvent) => {
      addError(event.reason);
    };

    window.addEventListener('error', handleErrorEvent);
    window.addEventListener('unhandledrejection', handleRejectionEvent);

    // Initial metrics refresh
    refreshMetrics();
    const interval = setInterval(refreshMetrics, 30000); // refresh every 30s

    return () => {
      window.removeEventListener('error', handleErrorEvent);
      window.removeEventListener('unhandledrejection', handleRejectionEvent);
      clearInterval(interval);
    };
  }, []);

  return (
    <ErrorContext.Provider
      value={{
        errors,
        isOverlayOpen,
        metrics,
        addError,
        resolveError,
        clearAllErrors,
        setOverlayOpen,
        refreshMetrics,
      }}
    >
      {children}
      <DiagnosticOverlay />
    </ErrorContext.Provider>
  );
}

/**
 * Access hook for the central error tracking context.
 */
export function useErrors() {
  const ctx = useContext(ErrorContext);
  if (!ctx) throw new Error('useErrors must be used within an ErrorProvider');
  return ctx;
}

/**
 * Futuristic slide-out overlay component displaying system vitals, 
 * active error queues, and detailed diagnostic stacks.
 */
export function DiagnosticOverlay() {
  const { errors, isOverlayOpen, setOverlayOpen, metrics, clearAllErrors, resolveError, refreshMetrics } = useErrors();
  const [activeTab, setActiveTab] = useState<'errors' | 'vitals'>('errors');

  const unresolvedCount = errors.filter((e) => !e.resolved).length;

  if (!isOverlayOpen) {
    if (unresolvedCount === 0) return null;

    // Toast Alert notification if errors exist but console is closed
    return (
      <div className="fixed bottom-6 right-6 z-50 animate-bounce">
        <button
          onClick={() => setOverlayOpen(true)}
          className="flex items-center gap-2.5 px-4 py-3 bg-red-950/90 hover:bg-red-900 border border-red-500/30 rounded-xl shadow-xl shadow-red-900/25 text-red-200 text-xs font-mono tracking-tight transition"
        >
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
          </span>
          <ShieldAlert size={14} className="text-red-400 animate-pulse" />
          <span>{unresolvedCount} Cortex Exceptions Active</span>
          <ChevronRight size={14} />
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-y-0 right-0 w-full max-w-md bg-slate-900/95 border-l border-slate-800 shadow-2xl backdrop-blur-md z-50 flex flex-col font-mono text-xs text-slate-300">
      <div className="absolute inset-0 bg-gradient-to-b from-slate-950/40 to-transparent pointer-events-none" />
      
      {/* Header */}
      <div className="relative p-4 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity size={16} className="text-purple-400 animate-pulse" />
          <span className="font-bold text-slate-100 tracking-tight text-sm">Cortex Diagnostic Console</span>
        </div>
        <button
          onClick={() => setOverlayOpen(false)}
          className="p-1 hover:bg-slate-850 rounded-lg text-slate-400 hover:text-slate-200 transition"
        >
          <X size={16} />
        </button>
      </div>

      {/* Navigation tabs */}
      <div className="flex border-b border-slate-800/80 bg-slate-950/20">
        <button
          onClick={() => setActiveTab('errors')}
          className={`flex-1 py-3 text-center font-bold relative border-b-2 transition ${
            activeTab === 'errors'
              ? 'text-purple-400 border-purple-500 bg-purple-500/5'
              : 'text-slate-500 border-transparent hover:text-slate-300'
          }`}
        >
          Active Logs ({unresolvedCount})
        </button>
        <button
          onClick={() => setActiveTab('vitals')}
          className={`flex-1 py-3 text-center font-bold relative border-b-2 transition ${
            activeTab === 'vitals'
              ? 'text-purple-400 border-purple-500 bg-purple-500/5'
              : 'text-slate-500 border-transparent hover:text-slate-300'
          }`}
        >
          System Vitals
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {activeTab === 'errors' ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-[10px] text-slate-500">
              <span>Exception buffer: {errors.length} traces</span>
              {errors.length > 0 && (
                <button
                  onClick={clearAllErrors}
                  className="hover:text-red-400 transition underline decoration-dotted"
                >
                  Clear all buffers
                </button>
              )}
            </div>

            {errors.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center space-y-2 text-slate-500">
                <CheckCircle2 size={32} className="text-green-500" />
                <span className="font-bold text-slate-300 text-xs">Cortex Pipeline Healthy</span>
                <span className="text-[10px] max-w-xs">All channels are operational. Real-time diagnostic monitors active.</span>
              </div>
            ) : (
              <div className="space-y-3">
                {errors.map((e) => (
                  <div
                    key={e.id}
                    className={`p-3 border rounded-xl transition ${
                      e.resolved
                        ? 'bg-slate-950/20 border-slate-850/40 opacity-50'
                        : 'bg-slate-950 border-red-900/30'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex gap-2 text-slate-300">
                        <AlertCircle
                          size={14}
                          className={`mt-0.5 shrink-0 ${e.resolved ? 'text-slate-500' : 'text-red-400 animate-pulse'}`}
                        />
                        <div className="space-y-1">
                          <span className="font-bold text-slate-200 tracking-tight text-xs block">
                            {e.error.message}
                          </span>
                          <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] font-mono text-slate-500">
                            <span>CODE: {e.error.code}</span>
                            <span>STATUS: {e.error.status}</span>
                            {e.error.traceId && <span className="select-all">TRACE: {e.error.traceId}</span>}
                          </div>
                        </div>
                      </div>
                      
                      {!e.resolved && (
                        <button
                          onClick={() => resolveError(e.id)}
                          className="px-2 py-1 bg-slate-850 hover:bg-slate-800 rounded text-[9px] font-bold text-slate-400 hover:text-slate-200 transition border border-slate-750/50"
                        >
                          Resolve
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <h3 className="font-bold text-xs text-slate-400 uppercase tracking-wider mb-2">Vitals Telemetry</h3>
            
            {metrics ? (
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-500 block">CPU LOAD</span>
                  <div className="flex items-baseline gap-1 mt-1">
                    <Cpu size={12} className="text-purple-400" />
                    <span className="text-sm font-bold text-slate-200">
                      {(metrics.cpuLoad * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>

                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-500 block">MEMORY RATIO</span>
                  <div className="flex items-baseline gap-1 mt-1">
                    <Heart size={12} className="text-purple-400" />
                    <span className="text-sm font-bold text-slate-200">
                      {(metrics.memoryUsageRatio * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>

                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-500 block">GEMINI LATENCY</span>
                  <div className="flex items-baseline gap-1 mt-1">
                    <Activity size={12} className="text-purple-400" />
                    <span className="text-sm font-bold text-slate-200">
                      {metrics.geminiLatencyMs ? `${metrics.geminiLatencyMs.toFixed(0)}ms` : '0ms'}
                    </span>
                  </div>
                </div>

                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-500 block">DB FAILS (R/W)</span>
                  <div className="flex items-baseline gap-1 mt-1">
                    <Terminal size={12} className="text-purple-400" />
                    <span className="text-sm font-bold text-slate-200">
                      {metrics.firestoreReadErrors}/{metrics.firestoreWriteErrors}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-slate-500 py-4 text-center">Vitals fetching inactive or loading...</p>
            )}

            <div className="border-t border-slate-850 pt-4 mt-2">
              <span className="text-[10px] text-slate-500 uppercase tracking-widest block mb-2">Diagnostic Console Spec</span>
              <ul className="space-y-1 text-[10px] text-slate-400 leading-relaxed list-disc list-inside">
                <li>Automated tracing with custom Trace-IDs per-channel request</li>
                <li>Direct database write validation via client constraints</li>
                <li>Real-time telemetry streaming to cloud logs</li>
                <li>Integrated circuit breakers for neural pathways</li>
              </ul>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-slate-800 bg-slate-950 text-slate-500 text-[10px] text-center flex items-center justify-between">
        <span>STATE: ACTIVE_MONITOR</span>
        <button
          onClick={refreshMetrics}
          className="hover:text-slate-300 underline decoration-dotted transition"
        >
          Refresh vitals
        </button>
      </div>
    </div>
  );
}
export default ErrorProvider;
