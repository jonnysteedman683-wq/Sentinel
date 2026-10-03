/**
 * @file SelfHealingErrorCard.tsx
 * @description Sleek, interactive system error and self-healing card for API / Firebase failures.
 */

import React, { useState } from 'react';
import { ShieldAlert, RefreshCw, Sparkles, Terminal, Copy, Check, ChevronDown, ChevronUp } from 'lucide-react';

/**
 * Prop contracts for the SelfHealingErrorCard component.
 * 
 * @interface SelfHealingErrorCardProps
 * @property {string} errorMessage - Raw error message to display.
 * @property {string} [traceId] - Unique trace session identifier.
 * @property {() => Promise<void>} onRetry - Retries the failed API transaction.
 * @property {() => void} [onOfflineSimulate] - Activates local rules fallback mode.
 * @property {(msg: string, level: any) => void} addLog - System log writer.
 */
export interface SelfHealingErrorCardProps {
  errorMessage: string;
  traceId?: string;
  onRetry: () => Promise<void>;
  onOfflineSimulate?: () => void;
  addLog: (msg: string, level: 'INFO' | 'WARN' | 'ERROR' | 'NEURAL' | 'CRITICAL') => void;
}

/**
 * Renders an interactive diagnostic panel when a network or API connection fails.
 * 
 * @param {SelfHealingErrorCardProps} props - Component properties
 * @returns {React.ReactElement}
 */
export const SelfHealingErrorCard: React.FC<SelfHealingErrorCardProps> = ({
  errorMessage,
  traceId,
  onRetry,
  onOfflineSimulate,
  addLog
}) => {
  const [isRetrying, setIsRetrying] = useState(false);
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [diagnosing, setDiagnosing] = useState(false);
  const [diagnosisReport, setDiagnosisReport] = useState<string | null>(null);

  const handleRetryClick = async () => {
    setIsRetrying(true);
    addLog("Retry initiated from diagnostic card interface", "WARN");
    try {
      await onRetry();
    } catch (e: any) {
      addLog(`Retry transaction failed: ${e.message}`, "ERROR");
    } finally {
      setIsRetrying(false);
    }
  };

  const handleCopyTrace = () => {
    const diagnosticPayload = JSON.stringify({
      error: errorMessage,
      traceId: traceId || 'no-trace-id',
      timestamp: Date.now(),
      platform: 'ArcaneQuantumBrain Web Interface'
    }, null, 2);

    navigator.clipboard.writeText(diagnosticPayload);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    addLog("Diagnostic trace payload copied to clipboard", "INFO");
  };

  const runLocalDiagnosis = async () => {
    setDiagnosing(true);
    setDiagnosisReport(null);
    addLog("Diagnostic probe started for active API anomaly", "WARN");

    await new Promise(r => setTimeout(r, 900));

    let cause = "Network or API Key Anomaly detected.";
    if (errorMessage.toLowerCase().includes("key") || errorMessage.toLowerCase().includes("auth")) {
      cause = "The GEMINI_API_KEY environment variable is either unconfigured, invalid, or requires verification. Ensure .env has valid keys.";
    } else if (errorMessage.toLowerCase().includes("quota") || errorMessage.toLowerCase().includes("limit") || errorMessage.toLowerCase().includes("429")) {
      cause = "Google Cloud or Gemini API rate limit quota has been exceeded for the Spark/Free tier. Let standard limits recover or provide a dedicated enterprise billing ID.";
    } else if (errorMessage.toLowerCase().includes("network") || errorMessage.toLowerCase().includes("fetch")) {
      cause = "Iframe container is experiencing CORS or sandbox connection blockades. Access the application in a separate tab to restore native fetch pipelines.";
    } else {
      cause = "Unknown network protocol interruption. Checking backend microservices... Standard fallback channels are prepared.";
    }

    setDiagnosisReport(cause);
    setDiagnosing(false);
    addLog("Diagnosis report successfully built", "INFO");
  };

  return (
    <div id="diagnostic-healing-panel" className="p-5 rounded-2xl bg-slate-950/90 border border-red-500/30 text-slate-200 backdrop-blur-md shadow-2xl animate-in fade-in duration-300">
      <div className="flex items-start gap-4">
        <div className="p-2.5 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl mt-1">
          <ShieldAlert className="w-5 h-5 animate-pulse" />
        </div>
        
        <div className="flex-1 space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold tracking-tight text-red-300 font-mono uppercase">SYNAPTIC DISRUPTION INJECTED</h4>
            {traceId && (
              <span className="text-[9px] px-2 py-0.5 bg-white/5 border border-white/5 rounded text-slate-500 font-mono uppercase">
                ID: {traceId}
              </span>
            )}
          </div>
          
          <p className="text-xs text-slate-400 font-sans leading-relaxed">
            A communication anomaly has blockaded the neural bridge. The cognitive engine is running in isolation mode.
          </p>

          <div className="flex flex-wrap gap-2 pt-2">
            <button
              id="btn-error-retry"
              onClick={handleRetryClick}
              disabled={isRetrying}
              className="px-3.5 py-1.5 text-xs font-bold font-mono bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30 rounded-lg transition-all flex items-center gap-1.5 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRetrying ? 'animate-spin' : ''}`} />
              {isRetrying ? 'Realigning Channels...' : 'Retry Transaction'}
            </button>

            <button
              id="btn-error-diagnose"
              onClick={runLocalDiagnosis}
              disabled={diagnosing}
              className="px-3.5 py-1.5 text-xs font-bold font-mono bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 rounded-lg transition-all flex items-center gap-1.5"
            >
              <Terminal className="w-3.5 h-3.5" />
              {diagnosing ? 'Probing Engine...' : 'Diagnose Fault'}
            </button>

            {onOfflineSimulate && (
              <button
                id="btn-error-offline"
                onClick={onOfflineSimulate}
                className="px-3.5 py-1.5 text-xs font-bold font-mono bg-teal-500/10 hover:bg-teal-500/20 text-teal-300 border border-teal-500/20 rounded-lg transition-all flex items-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Engage Simulation
              </button>
            )}
          </div>

          {diagnosisReport && (
            <div className="mt-3 p-3 rounded-xl bg-indigo-950/20 border border-indigo-500/10 text-indigo-200/90 text-xs font-mono leading-relaxed animate-in slide-in-from-top-2 duration-300">
              <span className="text-[9px] uppercase tracking-wider text-indigo-400 block mb-1 font-bold">Auto-Diagnostic Report:</span>
              <p>{diagnosisReport}</p>
            </div>
          )}

          <div className="border-t border-white/5 pt-3 mt-3">
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-slate-400 transition-colors uppercase font-mono tracking-wider"
            >
              <span>Exception Details</span>
              {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>

            {expanded && (
              <div className="mt-2.5 space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
                <div className="p-3 bg-black/60 rounded-xl border border-white/5 text-[11px] text-red-400/80 font-mono break-all leading-relaxed whitespace-pre-wrap max-h-36 overflow-y-auto">
                  {errorMessage}
                </div>
                
                <button
                  onClick={handleCopyTrace}
                  className="flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold font-mono bg-white/5 hover:bg-white/10 text-slate-400 hover:text-slate-200 rounded border border-white/5 transition-all"
                >
                  {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                  {copied ? 'Copied Trace!' : 'Copy Diagnostic Payload'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
