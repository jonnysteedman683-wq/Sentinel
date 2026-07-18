import React, { useEffect, useState } from 'react';
import { Users, Bot, MessageSquare, Zap, Activity } from 'lucide-react';

interface DebateLogItem {
  agent: string;
  move: string;
  text: string;
  confidence?: number;
}

interface SubagentDebateArenaProps {
  logs: DebateLogItem[];
  theme: 'dark' | 'light';
  isComplete: boolean;
}

export function SubagentDebateArena({ logs, theme, isComplete }: SubagentDebateArenaProps) {
  const [displayedLogs, setDisplayedLogs] = useState<DebateLogItem[]>([]);

  // Simple staggered animation effect
  useEffect(() => {
    if (logs.length > displayedLogs.length) {
      const timeout = setTimeout(() => {
        setDisplayedLogs(logs.slice(0, displayedLogs.length + 1));
      }, 300);
      return () => clearTimeout(timeout);
    }
  }, [logs, displayedLogs]);

  // Extract unique agents
  const agents = Array.from(new Set(logs.map(l => l.agent)));

  return (
    <div className={`mt-6 p-1 rounded-2xl bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-transparent border ${theme === 'dark' ? 'border-white/10' : 'border-indigo-500/20'}`}>
      <div className={`p-4 rounded-xl ${theme === 'dark' ? 'bg-slate-900/80 backdrop-blur-md' : 'bg-white/80 backdrop-blur-md'}`}>
        
        {/* Header */}
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-indigo-500/20 border border-indigo-500/30">
              <Users className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold uppercase tracking-widest text-indigo-400">Subagent Debate Arena</h3>
              <p className="text-[10px] text-slate-500">Multi-agent Cognitive Resolution</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!isComplete && (
              <span className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-indigo-400 animate-pulse border border-indigo-500/30 px-2 py-1 rounded bg-indigo-500/10">
                <Activity className="w-3 h-3" /> Debating
              </span>
            )}
            {isComplete && (
              <span className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-emerald-400 border border-emerald-500/30 px-2 py-1 rounded bg-emerald-500/10">
                <Zap className="w-3 h-3" /> Consensus Reached
              </span>
            )}
          </div>
        </div>

        {/* Active Agents */}
        <div className="flex items-center gap-4 mb-6">
          <span className="text-[10px] uppercase tracking-widest text-slate-500">Active Entities:</span>
          {agents.map(agent => (
            <div key={agent} className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-white/5 border border-white/10 text-xs font-mono text-slate-300">
              <Bot className="w-3 h-3 text-indigo-400" />
              {agent}
            </div>
          ))}
        </div>

        {/* Debate Transcript (Animated) */}
        <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
          {displayedLogs.map((log, idx) => {
            const isLatest = idx === displayedLogs.length - 1;
            const isSynthesizer = log.agent === 'SYNTHESIZER';
            
            return (
              <div 
                key={idx} 
                className={`flex gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300 ${
                  isSynthesizer ? 'ml-8' : ''
                }`}
              >
                <div className={`p-2 h-fit rounded-lg border flex-shrink-0 ${
                  isSynthesizer 
                    ? 'bg-fuchsia-500/10 border-fuchsia-500/30 text-fuchsia-400' 
                    : 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400'
                }`}>
                  <MessageSquare className="w-4 h-4" />
                </div>
                
                <div className={`flex-1 p-3 rounded-xl border ${
                  isSynthesizer 
                    ? 'bg-fuchsia-500/5 border-fuchsia-500/20' 
                    : theme === 'dark' ? 'bg-white/5 border-white/5' : 'bg-slate-50 border-slate-200'
                } ${isLatest && !isComplete ? 'ring-1 ring-indigo-500/50' : ''}`}>
                  <div className="flex justify-between items-center mb-1">
                    <span className={`text-[10px] font-bold uppercase tracking-wider ${
                      isSynthesizer ? 'text-fuchsia-400' : 'text-indigo-400'
                    }`}>
                      {log.agent}
                    </span>
                    <span className="text-[9px] font-mono text-slate-500 uppercase tracking-tight bg-black/20 px-1.5 py-0.5 rounded">
                      Move: {log.move}
                    </span>
                  </div>
                  <p className={`text-sm leading-relaxed ${
                    theme === 'dark' ? 'text-slate-300' : 'text-slate-700'
                  }`}>
                    {log.text}
                  </p>
                  
                  {log.confidence && (
                    <div className="mt-2 w-full bg-black/20 h-1 rounded-full overflow-hidden">
                      <div 
                        className={`h-full ${isSynthesizer ? 'bg-fuchsia-500' : 'bg-indigo-500'}`} 
                        style={{ width: `${log.confidence * 100}%` }}
                      />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
