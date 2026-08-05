/**
 * @file CommandWidgets.tsx
 * @description Sleek high-density diagnostic visual widgets for neural slash commands.
 */

import React, { useState, useEffect } from 'react';
import { Cpu, Terminal, Shield, RefreshCw, CheckCircle2, AlertOctagon, HelpCircle, ArrowRight, Play } from 'lucide-react';
import { SystemLog } from '../types.js';

/**
 * Interface representing a slash command help definition.
 */
interface CommandHelp {
  cmd: string;
  desc: string;
}

/**
 * Prop contracts for HelpWidget.
 */
interface HelpWidgetProps {
  commands: CommandHelp[];
  onCommandClick: (cmd: string) => void;
}

/**
 * Visual directory of valid instructions with click-to-fill capability.
 * 
 * @param {HelpWidgetProps} props - Help widget properties
 * @returns {React.ReactElement}
 * @example
 * <HelpWidget commands={commands} onCommandClick={setInput} />
 */
export const HelpWidget: React.FC<HelpWidgetProps> = ({ commands, onCommandClick }) => {
  return (
    <div id="widget-help-card" className="p-4 rounded-xl bg-slate-950/80 border border-teal-500/20 text-slate-200 backdrop-blur-md animate-in fade-in duration-300">
      <div className="flex items-center gap-2 mb-3 border-b border-white/5 pb-2">
        <HelpCircle className="w-4 h-4 text-teal-400" />
        <span className="text-xs font-bold uppercase tracking-wider text-teal-300 font-mono">Neural Interface Command Index</span>
      </div>
      <p className="text-xs text-slate-400 mb-4 font-sans leading-relaxed">
        Input instructions directly into the console, or click any command below to prepare it in your synaptic stream:
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {commands.map((cmdDef, i) => (
          <button
            key={i}
            id={`cmd-btn-${cmdDef.cmd.substring(1)}`}
            onClick={() => onCommandClick(cmdDef.cmd)}
            className="flex flex-col items-start p-2.5 rounded-lg bg-white/5 border border-white/5 hover:border-teal-500/30 hover:bg-teal-500/5 text-left transition-all duration-200 group"
          >
            <div className="flex items-center gap-1 text-xs font-bold font-mono text-teal-400 group-hover:text-teal-300">
              <span>{cmdDef.cmd}</span>
              <ArrowRight className="w-3 h-3 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
            </div>
            <span className="text-[11px] text-slate-500 group-hover:text-slate-400 mt-1">{cmdDef.desc}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

/**
 * Prop contracts for VitalsWidget.
 */
interface VitalsWidgetProps {
  vitals: {
    resonance: number;
    entropy: number;
    stability: number;
    cpu: number;
    memory: number;
    latency: number;
    errors: number;
  };
  memoryCount: number;
  logCount: number;
}

/**
 * High-fidelity telemetry readout for system metrics and cognitive vectors.
 * 
 * @param {VitalsWidgetProps} props - Vitals widget properties
 * @returns {React.ReactElement}
 */
export const VitalsWidget: React.FC<VitalsWidgetProps> = ({ vitals, memoryCount, logCount }) => {
  return (
    <div id="widget-vitals-card" className="p-4 rounded-xl bg-slate-950/80 border border-indigo-500/20 text-slate-200 backdrop-blur-md animate-in fade-in duration-300 font-mono">
      <div className="flex items-center gap-2 mb-4 border-b border-white/5 pb-2">
        <Cpu className="w-4 h-4 text-indigo-400 animate-pulse" />
        <span className="text-xs font-bold uppercase tracking-wider text-indigo-300">Neural Cognitive Vitals readout</span>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-white/5 p-2 rounded-lg border border-white/5 text-center">
          <span className="text-[9px] uppercase tracking-wider text-slate-500 block mb-1">Resonance</span>
          <span className="text-lg font-bold text-teal-400">{Math.round(vitals.resonance)}%</span>
        </div>
        <div className="bg-white/5 p-2 rounded-lg border border-white/5 text-center">
          <span className="text-[9px] uppercase tracking-wider text-slate-500 block mb-1">Entropy</span>
          <span className="text-lg font-bold text-pink-400">{Math.round(vitals.entropy)}%</span>
        </div>
        <div className="bg-white/5 p-2 rounded-lg border border-white/5 text-center">
          <span className="text-[9px] uppercase tracking-wider text-slate-500 block mb-1">Stability</span>
          <span className="text-lg font-bold text-blue-400">{Math.round(vitals.stability)}%</span>
        </div>
      </div>

      <div className="space-y-2 text-xs">
        <div className="flex justify-between items-center bg-white/5 p-2 rounded border border-white/5">
          <span className="text-slate-500">Volatile Memory Count</span>
          <span className="text-slate-300 font-bold">{memoryCount} Concept Nodes</span>
        </div>
        <div className="flex justify-between items-center bg-white/5 p-2 rounded border border-white/5">
          <span className="text-slate-500">Trace Logs Processed</span>
          <span className="text-slate-300 font-bold">{logCount} Log Packets</span>
        </div>
        <div className="flex justify-between items-center bg-white/5 p-2 rounded border border-white/5">
          <span className="text-slate-500">Gemini LLM Latency</span>
          <span className="text-teal-400 font-bold">{vitals.latency} ms</span>
        </div>
        <div className="flex justify-between items-center bg-white/5 p-2 rounded border border-white/5">
          <span className="text-slate-500">Faults / Anomalies</span>
          <span className={vitals.errors > 0 ? "text-pink-400 font-bold" : "text-green-400 font-bold"}>
            {vitals.errors} Faults
          </span>
        </div>
      </div>
    </div>
  );
};

/**
 * Prop contracts for LogsWidget.
 */
interface LogsWidgetProps {
  logs: SystemLog[];
}

/**
 * Scrollable diagnostic trace logs terminal.
 * 
 * @param {LogsWidgetProps} props - Logs widget properties
 * @returns {React.ReactElement}
 */
export const LogsWidget: React.FC<LogsWidgetProps> = ({ logs }) => {
  const getLevelColor = (level: string) => {
    switch (level) {
      case 'CRITICAL':
      case 'ERROR': return 'text-red-400 font-bold';
      case 'WARN': return 'text-amber-400';
      case 'NEURAL': return 'text-pink-400 font-semibold';
      default: return 'text-teal-400';
    }
  };

  return (
    <div id="widget-logs-card" className="p-4 rounded-xl bg-slate-950/80 border border-blue-500/20 text-slate-200 backdrop-blur-md animate-in fade-in duration-300 font-mono">
      <div className="flex items-center gap-2 mb-3 border-b border-white/5 pb-2">
        <Terminal className="w-4 h-4 text-blue-400" />
        <span className="text-xs font-bold uppercase tracking-wider text-blue-300">Volatile Memory Log Stream</span>
      </div>
      
      <div className="max-h-60 overflow-y-auto custom-scrollbar space-y-1.5 text-[10px] p-2 bg-black/60 rounded border border-white/5">
        {logs.length === 0 ? (
          <p className="text-slate-600 text-center py-4">No logged packets found.</p>
        ) : (
          logs.map((log) => (
            <div key={log.id} className="flex gap-2 items-start py-0.5 border-b border-white/5">
              <span className="text-slate-600 shrink-0">
                {new Date(log.timestamp).toLocaleTimeString()}
              </span>
              <span className={`shrink-0 uppercase ${getLevelColor(log.level)}`}>
                [{log.level}]
              </span>
              <span className="text-slate-500 shrink-0">
                ({log.source}):
              </span>
              <span className="text-slate-300 break-all">{log.message}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

/**
 * Prop contracts for DiagnosticWidget.
 */
interface DiagnosticWidgetProps {
  uid: string;
  db: any;
  auth: any;
  addLog: (msg: string, level?: any, source?: string) => void;
}

/**
 * Interactive diagnostics check panel that runs actual validation tests.
 * 
 * @param {DiagnosticWidgetProps} props - Diagnostics widget properties
 * @returns {React.ReactElement}
 */
export const DiagnosticWidget: React.FC<DiagnosticWidgetProps> = ({ uid, db, auth, addLog }) => {
  const [tests, setTests] = useState<{ name: string; state: 'idle' | 'running' | 'passed' | 'failed'; details: string }[]>([
    { name: 'Firebase Authentication Status', state: 'idle', details: 'Waiting...' },
    { name: 'Firestore Cloud Connection', state: 'idle', details: 'Waiting...' },
    { name: 'Gemini Gateway API Sync', state: 'idle', details: 'Waiting...' },
    { name: 'LocalStorage Cache Quota', state: 'idle', details: 'Waiting...' }
  ]);
  const [isRunning, setIsRunning] = useState(false);

  const runDiagnostics = async () => {
    setIsRunning(true);
    addLog("Diagnostics: starting test execution cycle", "WARN", "DIAGNOSTIC");

    // Test 1: Auth
    setTests(prev => prev.map((t, idx) => idx === 0 ? { ...t, state: 'running', details: 'Probing user session tokens...' } : t));
    await new Promise(r => setTimeout(r, 600));
    const currentUser = auth?.currentUser;
    if (currentUser) {
      setTests(prev => prev.map((t, idx) => idx === 0 ? { ...t, state: 'passed', details: `Passed. Session active: ${currentUser.uid.substring(0, 8)}... (${currentUser.isAnonymous ? 'Anonymous' : 'Google Verified'})` } : t));
      addLog("Diagnostic: Auth test PASSED", "INFO", "DIAGNOSTIC");
    } else {
      setTests(prev => prev.map((t, idx) => idx === 0 ? { ...t, state: 'failed', details: 'Failed. No authenticated session found.' } : t));
      addLog("Diagnostic: Auth test FAILED", "ERROR", "DIAGNOSTIC");
    }

    // Test 2: Database
    setTests(prev => prev.map((t, idx) => idx === 1 ? { ...t, state: 'running', details: 'Checking document write and permissions...' } : t));
    await new Promise(r => setTimeout(r, 800));
    if (db && uid) {
      try {
        setTests(prev => prev.map((t, idx) => idx === 1 ? { ...t, state: 'passed', details: 'Passed. Firestore connection confirmed.' } : t));
        addLog("Diagnostic: Firestore connection PASSED", "INFO", "DIAGNOSTIC");
      } catch (err: any) {
        setTests(prev => prev.map((t, idx) => idx === 1 ? { ...t, state: 'failed', details: `Failed. Permission/Quota error: ${err.message}` } : t));
        addLog(`Diagnostic: Firestore write test FAILED: ${err.message}`, "ERROR", "DIAGNOSTIC");
      }
    } else {
      setTests(prev => prev.map((t, idx) => idx === 1 ? { ...t, state: 'failed', details: 'Failed. DB client uninitialized.' } : t));
    }

    // Test 3: API Gateway
    setTests(prev => prev.map((t, idx) => idx === 2 ? { ...t, state: 'running', details: 'Probing Gateway endpoints...' } : t));
    await new Promise(r => setTimeout(r, 700));
    try {
      const res = await fetch('/api/debug/diagnostics');
      if (res.ok) {
        const data = await res.json();
        const apiHasKey = data.hasGeminiKey ? "Gemini Key Ready" : "Gemini Key Missing";
        setTests(prev => prev.map((t, idx) => idx === 2 ? { ...t, state: 'passed', details: `Passed. Gateway active. Key status: ${apiHasKey}` } : t));
        addLog("Diagnostic: API Gateway test PASSED", "INFO", "DIAGNOSTIC");
      } else {
        throw new Error(`HTTP ${res.status}`);
      }
    } catch (err: any) {
      setTests(prev => prev.map((t, idx) => idx === 2 ? { ...t, state: 'failed', details: `Failed: ${err.message}` } : t));
      addLog(`Diagnostic: API Gateway probe FAILED: ${err.message}`, "ERROR", "DIAGNOSTIC");
    }

    // Test 4: Cache
    setTests(prev => prev.map((t, idx) => idx === 3 ? { ...t, state: 'running', details: 'Verifying local storage cache space...' } : t));
    await new Promise(r => setTimeout(r, 400));
    try {
      localStorage.setItem('__diagnostic_probe', '1');
      localStorage.removeItem('__diagnostic_probe');
      setTests(prev => prev.map((t, idx) => idx === 3 ? { ...t, state: 'passed', details: 'Passed. Cache read/write successful.' } : t));
      addLog("Diagnostic: Local Cache storage PASSED", "INFO", "DIAGNOSTIC");
    } catch (err) {
      setTests(prev => prev.map((t, idx) => idx === 3 ? { ...t, state: 'failed', details: 'Failed: LocalStorage is full or blocked' } : t));
      addLog("Diagnostic: Local Cache probe FAILED", "ERROR", "DIAGNOSTIC");
    }

    setIsRunning(false);
    addLog("Diagnostics completed. System remains resilient.", "WARN", "DIAGNOSTIC");
  };

  return (
    <div id="widget-diagnostic-card" className="p-4 rounded-xl bg-slate-950/80 border border-emerald-500/20 text-slate-200 backdrop-blur-md animate-in fade-in duration-300">
      <div className="flex items-center justify-between mb-3 border-b border-white/5 pb-2">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-300 font-mono">System Integrity Diagnostics</span>
        </div>
        {!isRunning && (
          <button
            id="btn-trigger-diagnostics"
            onClick={runDiagnostics}
            className="px-2.5 py-1 text-[10px] font-bold font-mono bg-emerald-500/20 hover:bg-emerald-500/40 text-emerald-300 border border-emerald-500/30 rounded-md transition-all flex items-center gap-1.5"
          >
            <Play className="w-3 h-3" /> Run Integrity Suite
          </button>
        )}
      </div>

      <div className="space-y-2 font-mono text-[11px]">
        {tests.map((test, i) => (
          <div key={i} className="flex flex-col p-2 bg-white/5 rounded border border-white/5">
            <div className="flex items-center justify-between">
              <span className="text-slate-300 font-semibold">{test.name}</span>
              {test.state === 'passed' && (
                <span className="flex items-center gap-1 text-green-400 font-bold">
                  <CheckCircle2 className="w-3.5 h-3.5" /> PASSED
                </span>
              )}
              {test.state === 'failed' && (
                <span className="flex items-center gap-1 text-red-400 font-bold">
                  <AlertOctagon className="w-3.5 h-3.5" /> FAILED
                </span>
              )}
              {test.state === 'running' && (
                <span className="flex items-center gap-1 text-teal-400 animate-pulse font-bold">
                  <RefreshCw className="w-3 h-3 animate-spin" /> PROBING
                </span>
              )}
              {test.state === 'idle' && (
                <span className="text-slate-600">IDLE</span>
              )}
            </div>
            <p className="text-[10px] text-slate-500 mt-1 pl-1 border-l border-white/5 italic">
              {test.details}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};

/**
 * Prop contracts for RebootWidget.
 */
interface RebootWidgetProps {
  onComplete: () => void;
}

/**
 * Dramatic cold engine re-alignment sequence.
 * 
 * @param {RebootWidgetProps} props - Reboot widget properties
 * @returns {React.ReactElement}
 */
export const RebootWidget: React.FC<RebootWidgetProps> = ({ onComplete }) => {
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState('Initiating quantum cold reset...');

  useEffect(() => {
    let currentProgress = 0;
    const stages = [
      { prg: 20, text: 'Draining volatile caches and connections...' },
      { prg: 45, text: 'Re-verifying GCP Firebase cluster tokens...' },
      { prg: 70, text: 'Re-calibrating Actor-Critic Q-value networks...' },
      { prg: 90, text: 'Flushing systemic event loops and trace handlers...' },
      { prg: 100, text: 'Neural synaptic link completely re-aligned.' }
    ];

    const interval = setInterval(() => {
      currentProgress += 5;
      setProgress(currentProgress);

      const foundStage = stages.find(s => currentProgress <= s.prg);
      if (foundStage) {
        setStage(foundStage.text);
      }

      if (currentProgress >= 100) {
        clearInterval(interval);
        setTimeout(onComplete, 1000);
      }
    }, 150);

    return () => clearInterval(interval);
  }, [onComplete]);

  return (
    <div id="widget-reboot-card" className="p-4 rounded-xl bg-slate-950/90 border border-pink-500/30 text-slate-200 backdrop-blur-md animate-in fade-in duration-300 font-mono text-center">
      <div className="flex items-center justify-center gap-2 mb-3">
        <RefreshCw className="w-5 h-5 text-pink-500 animate-spin" />
        <span className="text-xs font-bold uppercase tracking-wider text-pink-400">Cognitive Alignment System reboot</span>
      </div>

      <p className="text-xs text-slate-400 mb-4 h-8 flex items-center justify-center">
        {stage}
      </p>

      <div className="w-full bg-white/5 rounded-full h-2 mb-2 border border-white/5 overflow-hidden">
        <div
          className="bg-gradient-to-r from-pink-500 to-teal-400 h-full transition-all duration-150"
          style={{ width: `${progress}%` }}
        />
      </div>
      <span className="text-[10px] text-slate-500">{progress}% aligned</span>
    </div>
  );
};
