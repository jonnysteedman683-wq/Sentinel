import React, { useEffect, useState } from 'react';
import { Cpu, Database, Network, Activity } from 'lucide-react';
import { LineChart, Line, ResponsiveContainer, YAxis, Tooltip } from 'recharts';

export function SystemMetrics() {
  const [cpu, setCpu] = useState(12);
  const [mem, setMem] = useState(34);
  const [net, setNet] = useState(8);

  const [tokenStats, setTokenStats] = useState({
    google: { reqs: 0, tokens: 0 },
    openai: { reqs: 0, tokens: 0 },
    anthropic: { reqs: 0, tokens: 0 },
    openrouter: { reqs: 0, tokens: 0 },
    groq: { reqs: 0, tokens: 0 }
  });

  const [providerStatus, setProviderStatus] = useState({
    google: { status: 'ONLINE', uptime: 99.99, ping: 45, errorRate: 0.01 },
    openai: { status: 'ONLINE', uptime: 99.85, ping: 120, errorRate: 0.05 },
    anthropic: { status: 'ONLINE', uptime: 99.92, ping: 85, errorRate: 0.02 },
    openrouter: { status: 'ONLINE', uptime: 99.50, ping: 180, errorRate: 0.12 },
    groq: { status: 'ONLINE', uptime: 99.95, ping: 25, errorRate: 0.01 }
  });

  const [history, setHistory] = useState(Array.from({ length: 20 }, (_, i) => ({
    time: i,
    google: 45 + Math.random() * 10,
    openai: 120 + Math.random() * 20,
    anthropic: 85 + Math.random() * 15,
    openrouter: 180 + Math.random() * 30,
    groq: 25 + Math.random() * 5
  })));

  useEffect(() => {
    const interval = setInterval(() => {
      setCpu(prev => Math.min(100, Math.max(0, prev + (Math.random() * 20 - 10))));
      setMem(prev => Math.min(100, Math.max(0, prev + (Math.random() * 10 - 5))));
      setNet(prev => Math.min(100, Math.max(0, prev + (Math.random() * 30 - 15))));

      setProviderStatus(prev => {
        const next = { ...prev };
        (Object.keys(next) as Array<keyof typeof next>).forEach(key => {
          next[key] = { ...next[key] };
          
          // Random walk for ping
          const volatility = key === 'groq' ? 2 : key === 'openrouter' ? 15 : 5;
          next[key].ping = Math.max(10, next[key].ping + (Math.random() * volatility * 2 - volatility));
          
          // Slight fluctuation in error rate
          next[key].errorRate = Math.max(0, Math.min(5, next[key].errorRate + (Math.random() * 0.1 - 0.05)));

          if (Math.random() > 0.98) {
            next[key].status = next[key].status === 'ONLINE' ? 'DEGRADED' : 'ONLINE';
          }
        });
        
        // Update history
        setHistory(h => {
          const newEntry = {
            time: Date.now(),
            google: next.google.ping,
            openai: next.openai.ping,
            anthropic: next.anthropic.ping,
            openrouter: next.openrouter.ping,
            groq: next.groq.ping
          };
          return [...h.slice(1), newEntry];
        });

        return next;
      });
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleUsage = (e: any) => {
      const { provider, usage } = e.detail;
      setTokenStats(prev => {
        const prov = provider as keyof typeof prev;
        if (!prev[prov]) return prev;
        return {
          ...prev,
          [prov]: {
            reqs: prev[prov].reqs + 1,
            tokens: prev[prov].tokens + (usage.totalTokens || 0)
          }
        };
      });
    };
    window.addEventListener('ai-usage', handleUsage);
    return () => window.removeEventListener('ai-usage', handleUsage);
  }, []);

  const totalTokens = Object.values(tokenStats).reduce((acc, curr) => acc + curr.tokens, 0);

  const getProviderColor = (p: string) => {
    switch (p) {
      case 'google': return '#3b82f6';
      case 'openai': return '#10b981';
      case 'anthropic': return '#f59e0b';
      case 'openrouter': return '#8b5cf6';
      case 'groq': return '#ef4444';
      default: return '#64748b';
    }
  };

  return (
    <div className="flex flex-col gap-4 text-[9px] font-mono tracking-widest text-slate-500 w-full">
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 w-12">
            <Cpu size={10} className="text-emerald-500" />
            <span>CPU</span>
          </div>
          <div className="flex-1 mx-2 h-1 bg-slate-800 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-500/80 transition-all duration-1000" style={{ width: `${cpu}%` }} />
          </div>
          <span className="w-8 text-right">{Math.round(cpu)}%</span>
        </div>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 w-12">
            <Database size={10} className="text-amber-500" />
            <span>MEM</span>
          </div>
          <div className="flex-1 mx-2 h-1 bg-slate-800 rounded-full overflow-hidden">
            <div className="h-full bg-amber-500/80 transition-all duration-1000" style={{ width: `${mem}%` }} />
          </div>
          <span className="w-8 text-right">{Math.round(mem)}%</span>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 w-12">
            <Network size={10} className="text-cyan-500" />
            <span>NET</span>
          </div>
          <div className="flex-1 mx-2 h-1 bg-slate-800 rounded-full overflow-hidden">
            <div className="h-full bg-cyan-500/80 transition-all duration-1000" style={{ width: `${net}%` }} />
          </div>
          <span className="w-8 text-right">{Math.round(net)}%</span>
        </div>
      </div>

      {/* AI Token Usage Widget */}
      <div className="pt-3 border-t border-slate-800/50 flex flex-col gap-2">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-1.5">
            <Cpu size={10} className="text-purple-500" />
            <span className="text-slate-400">AI TOKENS</span>
          </div>
          <span className="text-[8px] text-slate-500">
            TOTAL: {totalTokens.toLocaleString()}
          </span>
        </div>

        <div className="flex flex-col gap-2">
          {Object.entries(tokenStats).map(([provider, stats]) => (
            <div key={provider} className="flex items-center justify-between text-[8px]">
              <div className="flex items-center gap-1.5 w-20">
                <span className="uppercase text-slate-500">{provider}</span>
              </div>
              <div className="flex-1 mx-2 h-1 bg-slate-800 rounded-full overflow-hidden">
                <div 
                  className="h-full transition-all duration-500"
                  style={{ 
                    width: `${Math.min(100, (stats.tokens / 5000) * 100)}%`,
                    backgroundColor: getProviderColor(provider)
                  }} 
                />
              </div>
              <span className="w-10 text-right">{stats.tokens.toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>

      {/* AI Provider Status Widget */}
      <div className="pt-3 border-t border-slate-800/50 flex flex-col gap-2">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-1.5">
            <Network size={10} className="text-blue-500" />
            <span className="text-slate-400">AI PROVIDERS</span>
          </div>
          <span className="text-[8px] text-slate-500">ERR RATE</span>
        </div>

        <div className="flex flex-col gap-2">
          {Object.entries(providerStatus).map(([provider, details]) => (
            <div key={provider} className="flex items-center justify-between text-[8px]">
              <div className="flex items-center gap-1.5 w-20">
                <div className={`w-1.5 h-1.5 rounded-full ${details.status === 'ONLINE' ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`} />
                <span className="uppercase text-slate-500" style={{ color: getProviderColor(provider) }}>{provider}</span>
              </div>
              <div className="flex flex-col items-end w-16">
                 <span className={details.status === 'ONLINE' ? 'text-emerald-500' : 'text-amber-500'}>{details.status}</span>
                 <span className="text-[7px] text-slate-600">{details.uptime}% UPTIME</span>
              </div>
              <span className="w-10 text-right font-bold" style={{ color: details.errorRate > 1 ? '#ef4444' : '#10b981' }}>
                {details.errorRate.toFixed(2)}%
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Provider Health Widget (Latency) */}
      <div className="pt-3 border-t border-slate-800/50 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Activity size={10} className="text-rose-500" />
            <span className="text-slate-400">LATENCY (MS)</span>
          </div>
          <span className="text-[8px] text-slate-500">
            REAL-TIME PING
          </span>
        </div>
        
        <div className="h-24 w-full opacity-80 mt-2">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={history}>
              {['google', 'openai', 'anthropic', 'openrouter', 'groq'].map((provider) => (
                <Line 
                  key={provider}
                  type="monotone" 
                  dataKey={provider} 
                  stroke={getProviderColor(provider)} 
                  strokeWidth={1.5} 
                  dot={false} 
                  isAnimationActive={false} 
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
