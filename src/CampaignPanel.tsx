import React, { useEffect } from 'react';
import { Map, Flag, Target, ArrowRight, CheckCircle2, Clock, Play } from 'lucide-react';
import { motion } from 'motion/react';
import { useSentinel } from './SentinelContext';

export function CampaignPanel() {
  const { addToast } = useSentinel();

  const milestones = [
    { id: 1, title: 'Autonomous Intelligence Campaign & Self Correction: Phase 1', status: 'completed', time: 'Completed 2 days ago' },
    { id: 2, title: 'Autonomous Intelligence Campaign & Self Correction: Phase 2', status: 'active', time: 'In Progress (Due Today)' },
    { id: 3, title: 'Autonomous Intelligence Campaign & Self Correction: Phase 3', status: 'pending', time: 'Scheduled for Next Week' },
    { id: 4, title: 'Autonomous Intelligence Campaign & Self Correction: Phase 4', status: 'pending', time: 'Scheduled for Q3' },
  ];

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-300 font-sans relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-orange-900/5 via-slate-950 to-slate-950 pointer-events-none z-0"></div>
      
      <div className="p-4 md:p-6 border-b border-slate-800/50 bg-slate-900/50 backdrop-blur flex justify-between items-center z-10 shadow-sm relative">
        <div className="flex items-center gap-3 text-orange-400 font-bold tracking-[0.2em] uppercase">
          <div className="p-1.5 bg-orange-500/10 rounded-lg border border-orange-500/20 shadow-[0_0_15px_rgba(249,115,22,0.15)]">
            <Map size={18} />
          </div>
          <span className="font-display text-lg">Fractal Campaign Planning</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 md:p-8 relative z-10">
        <div className="max-w-5xl mx-auto space-y-8">
          
          {/* Active Goal Header */}
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-8 relative overflow-hidden shadow-xl"
          >
            <div className="absolute top-0 right-0 p-8 opacity-5"><Target size={150} /></div>
            <div className="relative z-10">
              <div className="flex items-center gap-2 text-xs font-bold tracking-widest text-orange-400 mb-3 uppercase">
                <Target size={14} /> Primary Objective
              </div>
              <h1 className="text-3xl font-bold text-white mb-4 font-display tracking-tight">Autonomous Intelligence Campaign & Self Correction</h1>
              <p className="text-slate-400 max-w-2xl leading-relaxed">
                Establish a persistent, self-improving cognitive architecture capable of autonomous reasoning, skill distillation, and multimodal interaction.
              </p>
              
              <div className="mt-6 flex gap-4">
                <div className="bg-slate-950/50 border border-slate-800 px-4 py-2 rounded-lg text-xs font-mono text-slate-400 flex items-center gap-2">
                  <span className="text-orange-500">T-MINUS:</span> 14 DAYS
                </div>
                <div className="bg-slate-950/50 border border-slate-800 px-4 py-2 rounded-lg text-xs font-mono text-slate-400 flex items-center gap-2">
                  <span className="text-emerald-500">COMPLETION:</span> 42%
                </div>
              </div>
            </div>
          </motion.div>

          {/* Gantt / Timeline View */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <h3 className="text-xs font-bold text-slate-500 mb-4 tracking-widest flex items-center gap-2 uppercase">
                <Flag size={14} /> Tactical Milestones
              </h3>
              
              <div className="space-y-4 relative">
                <div className="absolute left-6 top-8 bottom-8 w-[2px] bg-slate-800/80 rounded-full"></div>
                
                {milestones.map((m, i) => (
                  <motion.div 
                    key={m.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className={`relative pl-16 pr-4 py-2`}
                  >
                    <div className={`absolute left-[21px] top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 ${
                      m.status === 'completed' ? 'bg-emerald-500 border-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.5)]' :
                      m.status === 'active' ? 'bg-orange-500 border-orange-400 shadow-[0_0_10px_rgba(249,115,22,0.5)] animate-pulse' :
                      'bg-slate-900 border-slate-700'
                    }`}></div>
                    
                    <div className={`bg-slate-900/40 border ${m.status === 'active' ? 'border-orange-500/30 shadow-[0_0_15px_rgba(249,115,22,0.05)]' : 'border-slate-800/80'} rounded-xl p-5 hover:border-slate-700 transition-colors`}>
                      <div className="flex justify-between items-start mb-2">
                        <h4 className={`font-bold ${m.status === 'active' ? 'text-orange-400' : 'text-slate-200'}`}>{m.title}</h4>
                        {m.status === 'completed' && <CheckCircle2 size={16} className="text-emerald-500" />}
                        {m.status === 'active' && <Play size={16} className="text-orange-500" />}
                        {m.status === 'pending' && <Clock size={16} className="text-slate-600" />}
                      </div>
                      <div className="text-xs font-mono text-slate-500">{m.time}</div>
                      
                      {m.status === 'active' && (
                        <div className="mt-4 pt-4 border-t border-slate-800/50 space-y-2">
                          <div className="flex items-center gap-2 text-xs font-mono text-emerald-400/80 line-through">
                            <CheckCircle2 size={12} className="text-emerald-500" /> Refine Nexus UI
                          </div>
                          <div className="flex items-center gap-2 text-xs font-mono text-emerald-400/80 line-through">
                            <CheckCircle2 size={12} className="text-emerald-500" /> Implement WebRTC placeholders
                          </div>
                          <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
                            <ArrowRight size={12} className="text-orange-500/50" /> Integrate multi-agent swarm logic
                          </div>
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
            
            <div className="space-y-6">
               <motion.div 
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-6 shadow-inner"
              >
                <h3 className="text-xs font-bold text-slate-400 mb-4 tracking-widest uppercase border-b border-slate-800/50 pb-3">
                  Current Trajectory
                </h3>
                <p className="text-sm text-slate-300 leading-relaxed font-mono">
                  Analysis indicates a 96% probability of meeting the T-14 deadline, assuming no major architectural pivots. Sentinel has successfully implemented recent UI refinements.
                </p>
                <button className="mt-6 w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg text-xs font-bold tracking-widest transition-colors">
                  GENERATE SUB-TASKS
                </button>
              </motion.div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
