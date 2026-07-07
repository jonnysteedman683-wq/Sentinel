import React, { useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, updateActionStatus } from './db';
import { processActionQueue } from './autonomy';
import { Activity, Check, X, Shield, Play } from 'lucide-react';
import type { AutonomyAction } from './types';
import { motion, AnimatePresence } from 'motion/react';

export function AutonomyPanel() {
  const actions = useLiveQuery(
    () => db.actions.orderBy('timestamp').reverse().toArray(),
    []
  );

  // Poll for processing actions in the background for demo purposes
  useEffect(() => {
    const interval = setInterval(() => {
      processActionQueue();
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleApprove = async (action: AutonomyAction) => {
    if (action.id) {
      await updateActionStatus(action.id, 'approved');
      // If it's act-with-confirm, approving means we want it to act now
      // In a real system, we might queue it for execution. Here we just set status.
    }
  };

  const handleReject = async (action: AutonomyAction) => {
    if (action.id) {
      await updateActionStatus(action.id, 'rejected');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'text-amber-400 bg-amber-950/20 border-amber-900/40 shadow-[0_0_15px_rgba(245,158,11,0.05)]';
      case 'approved': return 'text-emerald-400 bg-emerald-950/20 border-emerald-900/40 shadow-[0_0_15px_rgba(16,185,129,0.05)]';
      case 'rejected': return 'text-rose-400 bg-rose-950/20 border-rose-900/40 shadow-[0_0_15px_rgba(244,63,94,0.05)]';
      case 'completed': return 'text-blue-400 bg-blue-950/20 border-blue-900/40 shadow-[0_0_15px_rgba(59,130,246,0.05)]';
      case 'failed': return 'text-rose-500 bg-rose-950/20 border-rose-900/40 shadow-[0_0_15px_rgba(244,63,94,0.05)]';
      default: return 'text-slate-400 bg-slate-900/50 border-slate-800 shadow-sm';
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-300 font-mono text-sm border-r border-slate-800 relative">
      <div className="p-4 border-b border-slate-800/50 bg-slate-900/50 backdrop-blur flex justify-between items-center z-10 shadow-sm relative">
        <div className="flex items-center gap-3 text-amber-500 font-bold tracking-widest">
          <div className="p-1.5 bg-amber-500/10 rounded border border-amber-500/20 shadow-[0_0_15px_rgba(245,158,11,0.1)]">
            <Activity size={16} />
          </div>
          <span>AUTONOMY LOOP</span>
        </div>
        <div className="text-xs text-amber-500 font-bold tracking-widest px-3 py-1 bg-amber-950/30 rounded-full border border-amber-900/50">
          {actions?.filter(a => a.status === 'pending').length || 0} PENDING
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-6 space-y-6 scroll-smooth relative z-10">
        <AnimatePresence>
          {actions?.map(action => (
            <motion.div 
              initial={{ opacity: 0, y: 10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              key={action.id} 
              className={`border rounded-xl overflow-hidden backdrop-blur-sm transition-colors ${getStatusColor(action.status)}`}
            >
              <div className="px-5 py-3 flex justify-between items-center text-xs font-bold border-b border-current/20 bg-current/5">
                <div className="flex items-center gap-2">
                  <Shield size={14} />
                  <span className="uppercase tracking-widest">TIER: {action.tier}</span>
                </div>
                <span className={`uppercase tracking-widest px-2 py-1 rounded border border-current/20 ${action.status === 'pending' ? 'animate-pulse' : ''}`}>{action.status}</span>
              </div>
              
              <div className="p-6">
                <div className="text-xl font-bold text-slate-200 mb-3 tracking-tight">{action.intent}</div>
                <div className="mb-5 bg-slate-950/80 p-4 rounded-lg border border-slate-800/80 text-sm shadow-inner relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500/50"></div>
                  <div className="text-emerald-500 mb-2 flex items-center gap-2 font-bold tracking-widest text-xs">
                    <Play size={14}/> PROPOSED ACTION
                  </div>
                  <div className="font-mono text-emerald-400/90 pl-1">{action.proposedAction}</div>
                </div>
                
                <div className="text-sm text-slate-400 mb-5 pl-2 border-l-2 border-slate-700/50">
                  <span className="font-bold tracking-widest text-slate-500 text-xs block mb-1">REASONING</span> 
                  {action.reasoning}
                </div>

                {action.status === 'pending' && action.tier !== 'act' && (
                  <div className="flex gap-4 mt-6 pt-6 border-t border-current/10">
                    <button 
                      onClick={() => handleApprove(action)}
                      className="flex-1 flex items-center justify-center gap-2 bg-emerald-600/90 hover:bg-emerald-500 text-white border border-emerald-500/50 rounded-lg py-3 font-bold tracking-widest shadow-[0_0_15px_rgba(16,185,129,0.2)] hover:shadow-[0_0_20px_rgba(16,185,129,0.4)] transition-all"
                    >
                      <Check size={18} /> APPROVE
                    </button>
                    <button 
                      onClick={() => handleReject(action)}
                      className="flex-1 flex items-center justify-center gap-2 bg-rose-950/60 hover:bg-rose-900 text-rose-400 border border-rose-900/60 rounded-lg py-3 font-bold tracking-widest transition-all"
                    >
                      <X size={18} /> REJECT
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          ))}

          {actions?.length === 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-full flex items-center justify-center text-slate-600 tracking-widest text-sm font-bold">
              [ NO ACTIONS IN QUEUE ]
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
