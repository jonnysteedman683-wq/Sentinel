import React, { useState, useEffect } from 'react';
import { Activity, Server, Cpu, Database, Zap, RefreshCw, AlertTriangle, ShieldCheck } from 'lucide-react';
import { fetchWithTracing } from '../../lib/fetchWithTracing.js';

interface HealthMetrics {
  status: 'healthy' | 'degraded' | 'critical';
  memoryUsage: { heapUsed: number, heapTotal: number, rss: number };
  activeConnections: number;
  unhandledErrors: number;
  uptime: number;
  lastCheck: number;
}

export function SystemDiagnosticsUI({ theme }: { theme: 'dark' | 'light' }) {
  const [metrics, setMetrics] = useState<HealthMetrics | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isHealing, setIsHealing] = useState(false);

  const fetchHealth = async () => {
    setIsRefreshing(true);
    try {
      const res = await fetchWithTracing('/api/system/health');
      const data = await res.json();
      setMetrics(data);
    } catch (e) {
      console.error(e);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 5000);
    return () => clearInterval(interval);
  }, []);

  const triggerSelfHealing = async () => {
    setIsHealing(true);
    try {
      // Simulate calling a self-healing endpoint (which we will add)
      await fetchWithTracing('/api/system/heal', { method: 'POST' });
      await fetchHealth();
    } catch (e) {
      console.error(e);
    } finally {
      setTimeout(() => setIsHealing(false), 1000);
    }
  };

  if (!metrics) {
    return (
      <div className="flex items-center justify-center h-full text-slate-500">
        <RefreshCw className="w-6 h-6 animate-spin mr-2" /> Loading Telemetry...
      </div>
    );
  }

  const memoryPercent = Math.round((metrics.memoryUsage.heapUsed / metrics.memoryUsage.heapTotal) * 100);

  return (
    <div className="flex flex-col h-full p-6 animate-in fade-in slide-in-from-right-4 duration-300">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-xl border ${
            metrics.status === 'healthy' ? 'bg-emerald-500/20 border-emerald-500/30' :
            metrics.status === 'degraded' ? 'bg-amber-500/20 border-amber-500/30' :
            'bg-red-500/20 border-red-500/30'
          }`}>
            <Server className={`w-6 h-6 ${
              metrics.status === 'healthy' ? 'text-emerald-400' :
              metrics.status === 'degraded' ? 'text-amber-400' :
              'text-red-400'
            }`} />
          </div>
          <div>
            <h2 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-cyan-500 tracking-tight">
              DevOps Command Center
            </h2>
            <p className="text-xs text-slate-400 font-medium flex items-center gap-2">
              Status: 
              <span className={`uppercase font-bold tracking-widest ${
                metrics.status === 'healthy' ? 'text-emerald-400' :
                metrics.status === 'degraded' ? 'text-amber-400' :
                'text-red-400'
              }`}>
                {metrics.status}
              </span>
            </p>
          </div>
        </div>
        
        <div className="flex gap-2">
          <button 
            onClick={fetchHealth}
            disabled={isRefreshing}
            className="p-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
          <button 
            onClick={triggerSelfHealing}
            disabled={isHealing || metrics.status === 'healthy'}
            className={`px-4 py-2 rounded-xl border flex items-center gap-2 text-sm font-semibold transition-all ${
              isHealing ? 'bg-cyan-500/20 border-cyan-500/30 text-cyan-400 animate-pulse' :
              metrics.status === 'healthy' ? 'bg-slate-800/50 border-slate-700 text-slate-500 cursor-not-allowed' :
              'bg-cyan-500/20 border-cyan-500/40 text-cyan-400 hover:bg-cyan-500/30 hover:shadow-[0_0_15px_rgba(6,182,212,0.3)]'
            }`}
          >
            {isHealing ? <ShieldCheck className="w-4 h-4" /> : <Zap className="w-4 h-4" />}
            {isHealing ? 'Executing Protocol...' : 'Run Self-Healing Protocol'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="p-4 rounded-2xl bg-slate-900/50 border border-slate-800">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-400 flex items-center gap-2">
              <Cpu className="w-4 h-4 text-purple-400" /> V8 Heap Memory
            </h3>
            <span className="text-xs font-mono text-purple-300 bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">
              {Math.round(metrics.memoryUsage.heapUsed / 1024 / 1024)}MB / {Math.round(metrics.memoryUsage.heapTotal / 1024 / 1024)}MB
            </span>
          </div>
          <div className="w-full bg-slate-800 rounded-full h-3 border border-slate-700 overflow-hidden relative">
            <div 
              className={`h-full rounded-full transition-all duration-1000 ${
                memoryPercent > 90 ? 'bg-red-500' :
                memoryPercent > 70 ? 'bg-amber-500' :
                'bg-gradient-to-r from-purple-500 to-fuchsia-400'
              }`}
              style={{ width: `${memoryPercent}%` }}
            />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/50 border border-slate-800">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-slate-400 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400" /> Unhandled Errors
            </h3>
          </div>
          <div className="flex items-end gap-2 mt-2">
            <span className={`text-4xl font-black ${metrics.unhandledErrors > 0 ? 'text-rose-400' : 'text-slate-600'}`}>
              {metrics.unhandledErrors}
            </span>
            <span className="text-xs text-slate-500 uppercase tracking-widest font-bold mb-1">Since Boot</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/50 border border-slate-800">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-slate-400 flex items-center gap-2">
              <Database className="w-4 h-4 text-blue-400" /> Firebase Sync
            </h3>
          </div>
          <div className="flex items-end gap-2 mt-2">
            <span className="text-4xl font-black text-blue-400">
              {metrics.activeConnections}
            </span>
            <span className="text-xs text-slate-500 uppercase tracking-widest font-bold mb-1">Active Streams</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/50 border border-slate-800">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-slate-400 flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-400" /> Uptime
            </h3>
          </div>
          <div className="flex items-end gap-2 mt-2">
            <span className="text-4xl font-black text-emerald-400">
              {Math.round(metrics.uptime / 60)}
            </span>
            <span className="text-xs text-slate-500 uppercase tracking-widest font-bold mb-1">Minutes</span>
          </div>
        </div>
      </div>

      <div className="flex-1 rounded-2xl bg-slate-900/80 border border-slate-800 p-4 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10" style={{ 
          backgroundImage: 'linear-gradient(#22d3ee 1px, transparent 1px), linear-gradient(90deg, #22d3ee 1px, transparent 1px)',
          backgroundSize: '20px 20px',
          maskImage: 'radial-gradient(ellipse at center, black 40%, transparent 80%)'
        }} />
        
        <h3 className="text-xs font-semibold text-cyan-500 uppercase tracking-widest mb-4">Orchestrator Logs</h3>
        
        <div className="font-mono text-xs text-slate-400 space-y-2 h-full">
          <p className="text-cyan-400/80">&gt; Initializing SystemHealthCollector...</p>
          <p className="text-emerald-400/80">&gt; Memory footprint stable at {Math.round(metrics.memoryUsage.rss / 1024 / 1024)}MB RSS</p>
          {metrics.unhandledErrors > 0 && (
             <p className="text-amber-400/80">&gt; [WARNING] Detected {metrics.unhandledErrors} unhandled promise rejections. Recommend Self-Healing.</p>
          )}
          <p className="text-slate-500 animate-pulse">_</p>
        </div>
      </div>
    </div>
  );
}
