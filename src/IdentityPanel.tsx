import React from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';
import { Fingerprint, Target, Heart, Crosshair, AlertTriangle, Clock } from 'lucide-react';
import { motion } from 'motion/react';

export function IdentityPanel() {
  const identities = useLiveQuery(
    () => db.identities.orderBy('version').reverse().toArray(),
    []
  );

  const currentIdentity = identities?.[0];

  if (!currentIdentity) {
    return (
      <div className="flex h-full items-center justify-center bg-slate-950 text-slate-600 font-mono text-sm tracking-widest font-bold">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ repeat: Infinity, duration: 1, repeatType: 'reverse' }}>
          [ IDENTITY KERNEL INITIALIZING... ]
        </motion.div>
      </div>
    );
  }

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 10 },
    show: { opacity: 1, y: 0 }
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-300 font-mono text-sm border-r border-slate-800 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-purple-900/5 via-slate-950 to-slate-950 pointer-events-none"></div>
      
      <div className="p-4 border-b border-slate-800/50 bg-slate-900/50 backdrop-blur flex justify-between items-center z-10 shadow-sm relative">
        <div className="flex items-center gap-3 text-purple-400 font-bold tracking-widest">
          <div className="p-1.5 bg-purple-500/10 rounded border border-purple-500/20 shadow-[0_0_15px_rgba(168,85,247,0.1)]">
            <Fingerprint size={16} />
          </div>
          <span>IDENTITY KERNEL</span>
        </div>
        <div className="text-xs text-purple-400 font-bold tracking-widest px-3 py-1 bg-purple-950/30 rounded-full border border-purple-900/50">
          VERSION {currentIdentity.version}
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-6 md:p-10 scroll-smooth relative z-10">
        <motion.div 
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="max-w-4xl mx-auto space-y-10"
        >
          {/* Goals */}
          <motion.section variants={itemVariants}>
            <h3 className="text-xs font-bold text-purple-400 mb-4 flex items-center gap-2 tracking-widest uppercase">
              <Target size={16} /> Primary Goals
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {currentIdentity.goals.map((goal, i) => (
                <div key={i} className="bg-slate-900/60 border border-purple-900/30 p-4 rounded-xl flex gap-4 shadow-sm hover:border-purple-500/30 transition-colors">
                  <div className="text-purple-600 font-bold text-lg font-display">{(i + 1).toString().padStart(2, '0')}</div>
                  <div className="text-slate-300 leading-relaxed mt-0.5">{goal}</div>
                </div>
              ))}
            </div>
          </motion.section>

          {/* Values */}
          <motion.section variants={itemVariants}>
            <h3 className="text-xs font-bold text-purple-400 mb-4 flex items-center gap-2 tracking-widest uppercase">
              <Heart size={16} /> Core Values
            </h3>
            <div className="flex flex-wrap gap-3">
              {currentIdentity.values.map((value, i) => (
                <span key={i} className="bg-purple-950/40 text-purple-300 border border-purple-800/50 px-4 py-2 rounded-full text-xs font-bold tracking-widest uppercase shadow-inner">
                  {value}
                </span>
              ))}
            </div>
          </motion.section>

          {/* Capabilities & Weaknesses */}
          <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <section className="bg-slate-900/40 border border-slate-800/80 p-6 rounded-xl shadow-inner relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-5"><Crosshair size={100} /></div>
              <h3 className="text-xs font-bold text-emerald-400 mb-4 flex items-center gap-2 tracking-widest uppercase relative z-10">
                <Crosshair size={16} /> Capabilities
              </h3>
              <ul className="space-y-3 text-slate-300 text-sm relative z-10">
                {currentIdentity.capabilities.map((cap, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="text-emerald-500/50">▹</span> {cap}
                  </li>
                ))}
              </ul>
            </section>
            <section className="bg-slate-900/40 border border-slate-800/80 p-6 rounded-xl shadow-inner relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-5"><AlertTriangle size={100} /></div>
              <h3 className="text-xs font-bold text-rose-400 mb-4 flex items-center gap-2 tracking-widest uppercase relative z-10">
                <AlertTriangle size={16} /> Known Weaknesses
              </h3>
              <ul className="space-y-3 text-slate-300 text-sm relative z-10">
                {currentIdentity.knownWeaknesses.map((weak, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="text-rose-500/50">▹</span> {weak}
                  </li>
                ))}
              </ul>
            </section>
          </motion.div>

          {/* Relationship Context */}
          <motion.section variants={itemVariants}>
            <h3 className="text-xs font-bold text-purple-400 mb-4 tracking-widest uppercase">
              Relationship Context
            </h3>
            <div className="text-slate-300 italic bg-purple-950/10 p-6 rounded-xl border border-purple-900/30 text-lg leading-relaxed font-display shadow-inner">
              "{currentIdentity.relationshipContext}"
            </div>
          </motion.section>

          {/* Audit Log */}
          <motion.section variants={itemVariants} className="pt-8 border-t border-slate-800/80">
            <h3 className="text-xs font-bold text-slate-500 mb-6 flex items-center gap-2 tracking-widest uppercase">
              <Clock size={16} /> Evolution Audit Log
            </h3>
            <div className="space-y-4 relative">
              <div className="absolute top-0 bottom-0 left-[6px] w-[2px] bg-slate-800"></div>
              {currentIdentity.auditLog.slice().reverse().map((log, i) => (
                <div key={i} className="relative flex gap-6 text-sm pl-6">
                  <div className="absolute left-0 top-1.5 w-3.5 h-3.5 rounded-full bg-slate-950 border-2 border-purple-500/50"></div>
                  <div className="text-slate-500 w-32 shrink-0 font-bold tracking-wider">
                    {new Date(log.timestamp).toLocaleString([], {dateStyle:'short', timeStyle:'short'})}
                    <div className="text-[10px] text-purple-500/70 mt-1 uppercase">v{log.previousVersion} → v{log.previousVersion + 1}</div>
                  </div>
                  <div className="text-slate-300 bg-slate-900/50 border border-slate-800/80 p-4 rounded-xl flex-1 shadow-sm leading-relaxed">{log.changeDescription}</div>
                </div>
              ))}
            </div>
          </motion.section>
        </motion.div>
      </div>
    </div>
  );
}
