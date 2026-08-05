import React, { useState, useEffect } from 'react';
import { Sparkles, Zap, Network, BrainCircuit, Droplets } from 'lucide-react';

export const CognitiveSculptingConsole: React.FC<{ theme: string }> = ({ theme }) => {
  const [metrics, setMetrics] = useState({
    graphDensity: 0.12,
    avgEdgeTrace: 0.45,
    liquidEntropy: 0.88,
    recentAnomalies: 2,
    plasticityIndex: 0.76
  });

  const [logs, setLogs] = useState<string[]>([
    "System initialized.",
    "Awaiting cognitive events..."
  ]);

  useEffect(() => {
    // Simulate real-time metrics updates
    const interval = setInterval(() => {
      setMetrics(prev => ({
        ...prev,
        graphDensity: Math.min(1, Math.max(0, prev.graphDensity + (Math.random() - 0.5) * 0.01)),
        avgEdgeTrace: Math.min(1, Math.max(0, prev.avgEdgeTrace + (Math.random() - 0.5) * 0.02)),
        liquidEntropy: Math.min(1, Math.max(0, prev.liquidEntropy + (Math.random() - 0.5) * 0.05)),
        plasticityIndex: Math.min(1, Math.max(0, prev.plasticityIndex + (Math.random() - 0.5) * 0.03))
      }));
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleManualPrune = () => {
    setLogs(prev => ["[USER_OVERRIDE] Manual synaptic pruning initiated.", ...prev].slice(0, 10));
    // Call backend API in real app
    fetch('/api/sculpting/prune', { method: 'POST' }).catch(() => {});
  };

  const handleManualBridge = () => {
    setLogs(prev => ["[USER_OVERRIDE] Manual neurogenesis bridge requested.", ...prev].slice(0, 10));
    // Call backend API in real app
    fetch('/api/sculpting/bridge', { method: 'POST' }).catch(() => {});
  };

  return (
    <div className={`p-6 rounded-xl border ${theme === 'dark' ? 'bg-black/40 border-white/10' : 'bg-white/60 border-slate-200'} flex flex-col h-full min-h-[300px]`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold uppercase tracking-widest flex items-center gap-2 text-indigo-400">
          <BrainCircuit className="w-4 h-4" />
          Cognitive Sculpting Console
        </h3>
        <span className="text-[10px] font-mono text-slate-500 bg-slate-500/10 px-2 py-1 rounded">Phase 12 Integration</span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="p-3 bg-white/5 rounded-lg border border-white/5">
          <p className="text-[10px] uppercase text-slate-500 mb-1 flex items-center gap-1"><Network className="w-3 h-3"/> Graph Density</p>
          <p className="text-lg font-mono text-indigo-300">{(metrics.graphDensity * 100).toFixed(1)}%</p>
        </div>
        <div className="p-3 bg-white/5 rounded-lg border border-white/5">
          <p className="text-[10px] uppercase text-slate-500 mb-1 flex items-center gap-1"><Zap className="w-3 h-3"/> Avg Edge Trace</p>
          <p className="text-lg font-mono text-teal-300">{metrics.avgEdgeTrace.toFixed(2)}</p>
        </div>
        <div className="p-3 bg-white/5 rounded-lg border border-white/5">
          <p className="text-[10px] uppercase text-slate-500 mb-1 flex items-center gap-1"><Droplets className="w-3 h-3"/> Liquid Entropy</p>
          <p className="text-lg font-mono text-blue-300">{metrics.liquidEntropy.toFixed(2)}</p>
        </div>
        <div className="p-3 bg-white/5 rounded-lg border border-white/5">
          <p className="text-[10px] uppercase text-slate-500 mb-1 flex items-center gap-1"><Sparkles className="w-3 h-3"/> Plasticity Idx</p>
          <p className="text-lg font-mono text-fuchsia-300">{metrics.plasticityIndex.toFixed(2)}</p>
        </div>
      </div>

      <div className="flex gap-4 mb-6">
        <button 
          onClick={handleManualPrune}
          className="flex-1 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-semibold uppercase tracking-wider rounded-lg border border-rose-500/20 transition-colors"
        >
          Force Prune Weak Edges
        </button>
        <button 
          onClick={handleManualBridge}
          className="flex-1 py-2 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 text-xs font-semibold uppercase tracking-wider rounded-lg border border-indigo-500/20 transition-colors"
        >
          Trigger Neurogenesis
        </button>
      </div>

      <div className="flex-1 bg-black/50 rounded-lg p-3 overflow-y-auto custom-scrollbar border border-white/5">
        <h4 className="text-[10px] uppercase text-slate-500 mb-2 font-bold tracking-widest border-b border-white/10 pb-1">Event Log</h4>
        <div className="space-y-1 font-mono text-[10px]">
          {logs.map((log, i) => (
            <div key={i} className={`${i === 0 ? 'text-slate-200' : 'text-slate-500'}`}>
              <span className="text-indigo-400/50 mr-2">[{new Date().toLocaleTimeString()}]</span>
              {log}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
