import React from 'react';
import { 
  Cpu, Zap
} from 'lucide-react';
import { InfoTooltip } from '../InfoTooltip.js';
import { PersonaForm } from '../PersonaForm.js';
import { Activity } from 'lucide-react';

export interface BrainsTabProps {
  depth: string;
  setDepth: (d: any) => void;
  modelState: string;
  skills: any[];
  toggleSkill: (id: string) => void;
  neuralSway: { spins: number[], total: number, multiplier: number };
  triggerSwayRNG: () => void;
  isSpinning: boolean;
  PERSONAS: any[];
  activePersona: any;
  setActivePersona: (p: any) => void;
    agentStats: { epsilon: number, episodes: number, lastAction: number };
    addLog: (message: string, level?: any, source?: string) => void;
}

export const BrainsTab: React.FC<BrainsTabProps> = (props) => {
  const {
    neuralSway, triggerSwayRNG, isSpinning, PERSONAS, activePersona, setActivePersona,
    agentStats,
    addLog, modelState, skills, toggleSkill, depth
  } = props;

  return (
              <div className="animate-in fade-in slide-in-from-right-4 duration-300 flex flex-col h-full space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-indigo-400" />
                    <h3 className="text-indigo-400 text-xs font-bold uppercase tracking-widest">
                      <InfoTooltip label="Neural Persona Matrix">
                        The cognitive framework currently guiding the agent's behavior and reasoning style.
                      </InfoTooltip>
                    </h3>
                  </div>
                  <div className="flex items-center gap-2 px-2 py-1 bg-white/5 rounded-full border border-white/10">
                    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter">Current Sway:</span>
                    <span className={`text-[10px] font-mono font-bold ${neuralSway.multiplier > 1 ? 'text-amber-400' : 'text-slate-300'}`}>
                      {neuralSway.multiplier}x
                    </span>
                  </div>
                </div>

                {/* Sway RNG Machine */}
                <div className="bg-black/40 border border-white/5 rounded-2xl p-4 overflow-hidden relative">
                  <div className="absolute top-0 right-0 p-3 opacity-5 pointer-events-none">
                    <Zap className="w-12 h-12 text-amber-400" />
                  </div>
                  <div className="flex items-center justify-between mb-4">
                    <InfoTooltip label={<span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Neural Sway Engine</span>}>
                      A stochastic resonance generator that injects controlled variance into the agent's decision-making process.
                    </InfoTooltip>
                    <button 
                      onClick={triggerSwayRNG}
                      disabled={isSpinning}
                      className={`px-3 py-1 rounded-lg text-[9px] font-bold uppercase tracking-widest transition-all ${
                        isSpinning 
                          ? 'bg-slate-800 text-slate-600 cursor-not-allowed' 
                          : 'bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20'
                      }`}
                    >
                      {isSpinning ? 'Synchronizing...' : 'Trigger Spin'}
                    </button>
                  </div>
                  
                  <div className="flex justify-between items-center gap-2 mb-2">
                    {neuralSway.spins.map((spin, i) => (
                      <div key={i} className={`flex-1 h-12 rounded-xl flex items-center justify-center text-xl font-mono border transition-all duration-75 ${
                        isSpinning ? 'bg-amber-500/5 text-amber-500/50 border-amber-500/10' : 'bg-white/10 border-white/10'
                      }`}>
                        {spin}
                      </div>
                    ))}
                  </div>
                  
                  <div className="flex items-center justify-between mt-3 px-1">
                    <div className="flex gap-1">
                      {[1, 2, 3].map(i => (
                        <div key={i} className={`w-1.5 h-1.5 rounded-full ${neuralSway.multiplier >= i ? 'bg-amber-400' : 'bg-white/5'}`} />
                      ))}
                    </div>
                    <InfoTooltip label={<span className="text-[9px] font-mono text-slate-500">Total Density: {neuralSway.total}/15</span>}>
                      Cumulative weight of the current stochastic spin, influencing the magnitude of variance injected.
                    </InfoTooltip>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 gap-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                  {PERSONAS.map(p => (
                    <button
                      key={p.id}
                      onClick={() => {
                        setActivePersona(p);
                        addLog(`Persona shifted to ${p.name}`, 'NEURAL', 'ENGINE');
                      }}
                      className={`w-full text-left p-4 rounded-xl border transition-all duration-300 group ${
                        activePersona.id === p.id 
                          ? `bg-indigo-500/10 border-indigo-500/40 shadow-[0_0_20px_rgba(99,102,241,0.1)]` 
                          : `bg-black/20 border-white/5 hover:border-white/20`
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <div className={`w-1.5 h-1.5 rounded-full ${
                            p.color === 'teal' ? 'bg-teal-400' :
                            p.color === 'blue' ? 'bg-blue-400' :
                            p.color === 'purple' ? 'bg-purple-400' :
                            p.color === 'slate' ? 'bg-slate-400' :
                            p.color === 'red' ? 'bg-red-400' :
                            p.color === 'orange' ? 'bg-orange-400' : 'bg-white'
                          }`} />
                          <span className={`text-xs font-bold tracking-wider ${activePersona.id === p.id ? 'text-indigo-400' : 'text-slate-400'}`}>
                            {p.name}
                          </span>
                        </div>
                        {activePersona.id === p.id && (
                          <div className="flex items-center gap-2">
                            <span className="text-[8px] font-mono text-indigo-400/60 uppercase">Active</span>
                            <div className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
                          </div>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-500 leading-relaxed mb-3">
                        {p.description}
                      </p>
                      <div className={`text-[9px] font-mono italic transition-opacity ${
                        activePersona.id === p.id ? 'opacity-100 text-indigo-400/60' : 'opacity-0 group-hover:opacity-100 text-slate-600'
                      }`}>
                        "{p.signature}"
                      </div>
                    </button>
                  ))}
                  <PersonaForm />
                </div>
                <div className="bg-white/5 border border-white/10 p-4 rounded-lg flex flex-col gap-3 relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-2 opacity-10">
                    <Activity className="w-20 h-20" />
                  </div>
                  <h3 className="text-amber-400 text-xs font-bold uppercase tracking-widest mb-1">
                    <InfoTooltip label="Curiosity-Driven Engine (RL)">
                      A Reinforcement Learning model optimizing for maximum novelty and cognitive discovery over time.
                    </InfoTooltip>
                  </h3>
                  
                  <div className="flex flex-col gap-1">
                    <InfoTooltip label={<span className="text-[10px] text-slate-500 uppercase tracking-wider">Epsilon (Exploration Rate)</span>}>
                      The probability the agent will take a random, exploratory action rather than exploiting known optimal behavior.
                    </InfoTooltip>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-1.5 bg-black/50 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-amber-400 transition-all duration-300" 
                          style={{ width: `${(agentStats.epsilon) * 100}%` }}
                        />
                      </div>
                      <span className="text-[10px] font-mono text-amber-300">{agentStats.epsilon.toFixed(3)}</span>
                    </div>
                  </div>

                  <div className="flex justify-between items-center mt-2 border-t border-white/5 pt-3">
                    <div className="flex flex-col">
                      <InfoTooltip label={<span className="text-[10px] text-slate-500 uppercase tracking-wider">Total Episodes</span>}>
                        Total iterations the agent has completed in this session to update its knowledge and policy.
                      </InfoTooltip>
                      <span className="text-sm font-mono text-slate-300">{agentStats.episodes}</span>
                    </div>
                    <div className="flex flex-col text-right">
                      <InfoTooltip label={<span className="text-[10px] text-slate-500 uppercase tracking-wider">Last Action</span>}>
                        The most recent distinct cognitive maneuver chosen by the RL agent based on state evaluation.
                      </InfoTooltip>
                      <span className="text-sm font-mono text-amber-300">
                        {agentStats.lastAction === -1 ? 'None' : 
                         agentStats.lastAction === 0 ? 'Observe' : 
                         agentStats.lastAction === 1 ? 'Shift Depth' : 'Consolidate'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="bg-white/5 border border-white/10 p-4 rounded-lg flex flex-col gap-3 relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-2 opacity-10">
                    <Cpu className="w-20 h-20" />
                  </div>
                  <h3 className="text-indigo-400 text-xs font-bold uppercase tracking-widest mb-1">
                    <InfoTooltip label="Large Language Model">
                      The primary semantic processing core powering inference, dialogue, and summarization.
                    </InfoTooltip>
                  </h3>
                  
                  <div className="flex flex-col gap-2 relative z-10">
                    <div className="flex justify-between items-center">
                      <InfoTooltip label={<span className="text-[10px] text-slate-500 uppercase tracking-wider">Model Type</span>}>
                        The foundational neural architecture currently active (Gemini 1.5 Flash).
                      </InfoTooltip>
                      <span className="text-xs font-mono text-indigo-300">Gemini 1.5 Flash</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <InfoTooltip label={<span className="text-[10px] text-slate-500 uppercase tracking-wider">Cognitive Depth</span>}>
                        Determines the amount of context and recursive thought allocated to queries (e.g., Fast, Balanced, Deep Reasoning).
                      </InfoTooltip>
                      <span className="text-xs font-mono text-indigo-300">{depth}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <InfoTooltip label={<span className="text-[10px] text-slate-500 uppercase tracking-wider">State</span>}>
                        The current operational phase of the central orchestrator (e.g., Idle, Reasoning, Consolidating).
                      </InfoTooltip>
                      <span className="text-xs font-mono text-indigo-300">{modelState}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-white/5 border border-white/10 p-4 rounded-lg flex flex-col gap-3 relative overflow-hidden">
                  <h3 className="text-teal-400 text-xs font-bold uppercase tracking-widest mb-1">
                    <InfoTooltip label="Active Talents">
                      Modular cognitive sub-routines that extend the agent's baseline capabilities.
                    </InfoTooltip>
                  </h3>
                  <div className="space-y-3">
                    {skills.map(skill => (
                      <div key={skill.id} className="flex flex-col gap-1.5">
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-medium text-slate-300">{skill.name}</span>
                          <button 
                            onClick={() => toggleSkill(skill.id)}
                            className={`w-8 h-4 rounded-full relative transition-colors ${skill.active ? 'bg-teal-500' : 'bg-slate-700'}`}
                          >
                            <div className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full transition-transform ${skill.active ? 'translate-x-4' : 'translate-x-0'}`} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
  );
};
