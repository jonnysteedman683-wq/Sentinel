import React, { useState, useEffect } from 'react';
import { Activity, BrainCircuit, Code, Database, Eye, CheckCircle, Clock } from 'lucide-react';
import { SwarmState, SwarmAgentRole, SwarmMessage } from '../lib/swarm-engine.js';
import ReactMarkdown from 'react-markdown';

interface SwarmVisualizerProps {
  initialTask?: string;
}

export default function SwarmVisualizer({ initialTask }: SwarmVisualizerProps) {
  const [taskInput, setTaskInput] = useState(initialTask || '');
  const [activeSwarmId, setActiveSwarmId] = useState<string | null>(null);
  const [swarmState, setSwarmState] = useState<SwarmState | null>(null);

  const startSwarm = async () => {
    if (!taskInput.trim()) return;
    try {
      const res = await fetch('/api/swarm/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task: taskInput })
      });
      const data = await res.json();
      if (data.swarmId) {
        setActiveSwarmId(data.swarmId);
        setSwarmState(data.state);
        setTaskInput('');
      }
    } catch (e) {
      console.error("Failed to start swarm:", e);
    }
  };

  useEffect(() => {
    if (!activeSwarmId) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/swarm/poll?swarmId=${activeSwarmId}`);
        const data = await res.json();
        if (data.state) {
          setSwarmState(data.state);
          if (data.state.status === 'completed') {
            clearInterval(interval);
          }
        }
      } catch (e) {
        console.error("Failed to poll swarm state:", e);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [activeSwarmId]);

  const getAgentIcon = (role: SwarmAgentRole | 'System') => {
    switch (role) {
      case 'Architect': return <Database className="w-4 h-4 text-purple-400" />;
      case 'Philosopher': return <BrainCircuit className="w-4 h-4 text-emerald-400" />;
      case 'Coder': return <Code className="w-4 h-4 text-blue-400" />;
      case 'Tester': return <Eye className="w-4 h-4 text-orange-400" />;
      case 'Critic': return <Activity className="w-4 h-4 text-red-400" />;
      case 'System': return <Clock className="w-4 h-4 text-slate-400" />;
      default: return <BrainCircuit className="w-4 h-4 text-slate-400" />;
    }
  };

  const getAgentColor = (role: SwarmAgentRole | 'System') => {
    switch (role) {
      case 'Architect': return 'border-purple-500/50 bg-purple-500/10';
      case 'Philosopher': return 'border-emerald-500/50 bg-emerald-500/10';
      case 'Coder': return 'border-blue-500/50 bg-blue-500/10';
      case 'Tester': return 'border-orange-500/50 bg-orange-500/10';
      case 'Critic': return 'border-red-500/50 bg-red-500/10';
      case 'System': return 'border-slate-500/50 bg-slate-500/10 text-slate-400 text-xs italic';
      default: return 'border-slate-500/50 bg-slate-500/10';
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-200 font-sans">
      <div className="p-4 border-b border-white/10 shrink-0">
        <h2 className="text-xl font-light tracking-wide text-white mb-2">Autonomous Agentic Swarm</h2>
        <p className="text-sm text-slate-400 mb-4">Deploy a multi-agent swarm to architect, implement, and critique complex solutions autonomously.</p>
        
        <div className="flex gap-2">
          <input
            type="text"
            value={taskInput}
            onChange={(e) => setTaskInput(e.target.value)}
            placeholder="Assign a complex task to the swarm..."
            className="flex-1 bg-black/50 border border-white/10 rounded-lg px-4 py-2 focus:outline-none focus:border-teal-500/50"
            disabled={swarmState && swarmState.status !== 'completed'}
          />
          <button
            onClick={startSwarm}
            disabled={!taskInput.trim() || (swarmState && swarmState.status !== 'completed')}
            className="px-6 py-2 bg-teal-500/20 text-teal-300 border border-teal-500/50 rounded-lg hover:bg-teal-500/30 transition-colors disabled:opacity-50"
          >
            Deploy Swarm
          </button>
        </div>
      </div>

      {swarmState && (
        <div className="flex flex-1 overflow-hidden">
          {/* Messages Panel */}
          <div className="w-1/2 border-r border-white/10 flex flex-col p-4 overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold tracking-wider text-slate-400 uppercase">Live Inter-Agent Communication</h3>
              <span className={`text-xs px-2 py-1 rounded-full border ${swarmState.status === 'completed' ? 'bg-teal-500/20 border-teal-500/50 text-teal-400' : 'bg-amber-500/20 border-amber-500/50 text-amber-400'}`}>
                Status: {swarmState.status.toUpperCase()}
              </span>
            </div>

            <div className="flex flex-col gap-3">
              {swarmState.messages.map((msg: SwarmMessage) => (
                <div key={msg.id} className={`p-3 rounded-xl border ${getAgentColor(msg.role)} backdrop-blur-sm`}>
                  <div className="flex items-center gap-2 mb-1.5 opacity-80">
                    {getAgentIcon(msg.role)}
                    <span className="text-xs font-bold uppercase tracking-wider">{msg.role}</span>
                  </div>
                  <div className="text-sm prose prose-invert max-w-none">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                </div>
              ))}
              {swarmState.activeAgent && (
                <div className="p-3 rounded-xl border border-teal-500/50 bg-teal-500/10 backdrop-blur-sm animate-pulse">
                  <div className="flex items-center gap-2 opacity-80">
                    {getAgentIcon(swarmState.activeAgent)}
                    <span className="text-xs font-bold uppercase tracking-wider">{swarmState.activeAgent} is thinking...</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Scratchpad Panel */}
          <div className="w-1/2 flex flex-col p-4 overflow-y-auto bg-slate-900/50">
            <h3 className="text-sm font-semibold tracking-wider text-slate-400 uppercase mb-4">Shared Scratchpad</h3>
            <div className="flex-1 bg-black/50 border border-white/10 rounded-xl p-4 overflow-y-auto font-mono text-sm text-slate-300 whitespace-pre-wrap shadow-inner">
              {swarmState.scratchpad}
            </div>
          </div>
        </div>
      )}
      
      {!swarmState && (
        <div className="flex-1 flex flex-col items-center justify-center opacity-50 p-8 text-center">
          <BrainCircuit className="w-16 h-16 text-slate-600 mb-4" />
          <p className="text-lg">Swarm is Idle</p>
          <p className="text-sm text-slate-400 mt-2">Enter a complex task above to initialize the Agentic Swarm.</p>
        </div>
      )}
    </div>
  );
}
