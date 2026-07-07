import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';
import { Terminal, Zap, Clock, ShieldAlert, ChevronRight, ChevronDown, ArrowUpCircle, Component, Network } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { SkillCard } from './types';
import { useSentinel } from './SentinelContext';

const SkillTreeNode = ({ 
  skill, 
  allSkills, 
  selectedSkillId, 
  setSelectedSkillId, 
  depth = 0 
}: { 
  skill: SkillCard, 
  allSkills: SkillCard[], 
  selectedSkillId: string | null, 
  setSelectedSkillId: (id: string) => void,
  depth?: number
}) => {
  const [expanded, setExpanded] = useState(true);
  const isSelected = selectedSkillId === skill.id;
  
  const subSkills = allSkills.filter(s => s.parentId === skill.id);
  const upgrades = allSkills.filter(s => s.upgradesFromId === skill.id);
  const hasChildren = subSkills.length > 0 || upgrades.length > 0;

  return (
    <div className="flex flex-col relative">
      <motion.div 
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        onClick={() => setSelectedSkillId(skill.id!)}
        style={{ marginLeft: `${depth * 16}px` }}
        className={`p-3 rounded-xl cursor-pointer border transition-all duration-300 mb-2 z-10 relative ${
          isSelected 
            ? 'bg-fuchsia-900/20 border-fuchsia-500/50 text-fuchsia-300 shadow-[0_0_15px_rgba(192,38,211,0.1)]' 
            : 'bg-slate-900/50 border-slate-800 hover:border-fuchsia-900/50 text-slate-400 hover:bg-slate-900/80'
        }`}
      >
        <div className="flex items-center gap-2 mb-2">
          {hasChildren ? (
            <div onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }} className="text-slate-500 hover:text-slate-300 p-0.5 rounded-sm hover:bg-slate-800">
              {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </div>
          ) : <div className="w-[18px]"></div>}
          <div className="font-bold truncate tracking-wide flex-1 text-sm">{skill.name}</div>
          {skill.upgradesFromId && <ArrowUpCircle size={14} className="text-emerald-500/70" />}
          {skill.parentId && <Component size={14} className="text-blue-500/70" />}
        </div>
        <div className="flex justify-between items-center text-[10px] pl-6">
          <span className="opacity-70 truncate flex-1 mr-3 italic">{skill.triggerConditions[0]}</span>
          <span className={`px-1.5 py-0.5 rounded font-bold tracking-widest border ${
            skill.successScore >= 0.8 ? 'bg-emerald-950/50 text-emerald-400 border-emerald-900/50' :
            skill.successScore >= 0.5 ? 'bg-amber-950/50 text-amber-400 border-amber-900/50' :
            'bg-rose-950/50 text-rose-400 border-rose-900/50'
          }`}>
            {(skill.successScore * 100).toFixed(0)}%
          </span>
        </div>
      </motion.div>
      
      {expanded && hasChildren && (
        <div className="flex flex-col relative">
           {/* Tree line connector */}
           <div 
             className="absolute w-px bg-slate-800/80 z-0"
             style={{ 
               left: `${(depth * 16) + 16}px`, 
               top: '0', 
               bottom: '16px' 
             }}
           />
          {subSkills.map(child => (
            <SkillTreeNode 
              key={child.id} 
              skill={child} 
              allSkills={allSkills} 
              selectedSkillId={selectedSkillId} 
              setSelectedSkillId={setSelectedSkillId}
              depth={depth + 1}
            />
          ))}
          {upgrades.map(child => (
            <SkillTreeNode 
              key={child.id} 
              skill={child} 
              allSkills={allSkills} 
              selectedSkillId={selectedSkillId} 
              setSelectedSkillId={setSelectedSkillId}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export function SkillsPanel() {
  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null);

  const skills = useLiveQuery(
    () => db.skills.orderBy('successScore').reverse().toArray(),
    []
  );

  const selectedSkill = skills?.find(s => s.id === selectedSkillId);
  
  // Find top-level skills (no parent and no upgradesFrom)
  const rootSkills = skills?.filter(s => !s.parentId && !s.upgradesFromId) || [];

  const { setBreadcrumbs } = useSentinel();
  React.useEffect(() => {
    if (selectedSkill) {
      setBreadcrumbs([{ label: selectedSkill.name, onClick: () => setSelectedSkillId(null) }]);
    } else {
      setBreadcrumbs([]);
    }
  }, [selectedSkill?.name, setBreadcrumbs]);


  return (
    <div className="flex h-full bg-slate-950 text-slate-300 font-mono text-sm border-r border-slate-800">
      {/* Skills Tree List */}
      <div className="w-1/3 flex flex-col border-r border-slate-800/80 bg-slate-900/30">
        <div className="p-4 border-b border-slate-800/80 flex items-center gap-3 text-fuchsia-400 font-bold tracking-widest shadow-sm">
          <div className="p-1.5 bg-fuchsia-500/10 rounded border border-fuchsia-500/20">
            <Network size={16} />
          </div>
          <span>SKILL TREE</span>
        </div>
        
        <div className="flex-1 overflow-y-auto p-3 scroll-smooth">
          {rootSkills.map(skill => (
            <SkillTreeNode 
              key={skill.id} 
              skill={skill} 
              allSkills={skills || []} 
              selectedSkillId={selectedSkillId} 
              setSelectedSkillId={setSelectedSkillId} 
            />
          ))}
          
          {skills?.length === 0 && (
            <div className="text-center text-slate-600 py-20 text-xs tracking-widest font-bold">
              [ NO SKILLS DISTILLED YET ]
            </div>
          )}
        </div>
      </div>

      {/* Skill Details */}
      <div className="flex-1 flex flex-col bg-slate-950 relative overflow-hidden">
        <AnimatePresence mode="wait">
          {selectedSkill ? (
            <motion.div 
              key={selectedSkill.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-0 overflow-y-auto p-8 space-y-8"
            >
              <div className="border-b border-fuchsia-900/30 pb-6 relative">
                <div className="absolute top-0 right-0 p-3 bg-fuchsia-950/30 rounded-lg border border-fuchsia-900/50 flex flex-col items-end">
                  <span className="text-[10px] font-bold text-fuchsia-500/70 tracking-widest mb-1">SUCCESS SCORE</span>
                  <span className="text-2xl font-bold text-fuchsia-400">{(selectedSkill.successScore * 100).toFixed(0)}%</span>
                </div>
                <div className="flex items-center gap-3 mb-3 pr-32">
                  <h2 className="text-3xl font-bold text-fuchsia-400 tracking-tight">{selectedSkill.name}</h2>
                  {selectedSkill.tier && selectedSkill.tier > 1 && (
                    <span className="bg-emerald-900/40 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded text-xs font-bold tracking-wider flex items-center gap-1">
                      <ArrowUpCircle size={12} /> TIER {selectedSkill.tier}
                    </span>
                  )}
                  {selectedSkill.parentId && (
                    <span className="bg-blue-900/40 text-blue-400 border border-blue-500/30 px-2 py-0.5 rounded text-xs font-bold tracking-wider flex items-center gap-1">
                      <Component size={12} /> SUB-SKILL
                    </span>
                  )}
                </div>
                <p className="text-slate-300 text-base leading-relaxed pr-32">{selectedSkill.description}</p>
                
                {/* Parents/Upgrades Reference */}
                {(selectedSkill.parentId || selectedSkill.upgradesFromId) && (
                   <div className="mt-4 flex gap-4 text-xs">
                     {selectedSkill.parentId && (
                       <div className="flex items-center gap-2 text-blue-400/80 bg-blue-950/20 px-3 py-1.5 rounded-lg border border-blue-900/30 cursor-pointer hover:bg-blue-900/40" onClick={() => setSelectedSkillId(selectedSkill.parentId!)}>
                         <span className="opacity-60">Parent Skill:</span>
                         <span className="font-bold">{skills?.find(s => s.id === selectedSkill.parentId)?.name || 'Unknown'}</span>
                       </div>
                     )}
                     {selectedSkill.upgradesFromId && (
                       <div className="flex items-center gap-2 text-emerald-400/80 bg-emerald-950/20 px-3 py-1.5 rounded-lg border border-emerald-900/30 cursor-pointer hover:bg-emerald-900/40" onClick={() => setSelectedSkillId(selectedSkill.upgradesFromId!)}>
                         <span className="opacity-60">Upgrades From:</span>
                         <span className="font-bold">{skills?.find(s => s.id === selectedSkill.upgradesFromId)?.name || 'Unknown'}</span>
                       </div>
                     )}
                   </div>
                )}
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                <div className="space-y-8">
                  <div className="bg-black/20 p-5 rounded-xl border border-slate-800/80 shadow-inner">
                    <h3 className="text-xs font-bold text-fuchsia-500/70 mb-4 tracking-widest flex items-center gap-2">
                      <Zap size={14} className="text-amber-500" /> TRIGGER CONDITIONS
                    </h3>
                    <ul className="space-y-2 text-slate-300">
                      {selectedSkill.triggerConditions.map((tc, i) => (
                        <li key={i} className="flex gap-3 text-sm">
                          <span className="text-fuchsia-500/50 mt-1">▹</span> {tc}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="bg-black/20 p-5 rounded-xl border border-slate-800/80 shadow-inner">
                    <h3 className="text-xs font-bold text-fuchsia-500/70 mb-4 tracking-widest flex items-center gap-2">
                      <ShieldAlert size={14} className="text-rose-400" /> HEURISTICS
                    </h3>
                    <ul className="space-y-2 text-slate-300">
                      {selectedSkill.heuristics.map((h, i) => (
                        <li key={i} className="flex gap-3 text-sm">
                          <span className="text-fuchsia-500/50 mt-1">▹</span> {h}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="space-y-8">
                  <div className="bg-black/20 p-5 rounded-xl border border-slate-800/80 shadow-inner">
                    <h3 className="text-xs font-bold text-fuchsia-500/70 mb-4 tracking-widest">TOOL SEQUENCE</h3>
                    <div className="flex flex-wrap gap-2">
                      {selectedSkill.toolSequence.map((ts, i) => (
                        <span key={i} className="bg-slate-900 text-slate-300 px-3 py-1.5 rounded-lg text-xs border border-slate-700/80 font-semibold tracking-wider flex items-center gap-2">
                          <span className="text-fuchsia-500/50">{i + 1}.</span> {ts}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="bg-black/20 p-5 rounded-xl border border-slate-800/80 shadow-inner">
                    <h3 className="text-xs font-bold text-fuchsia-500/70 mb-4 tracking-widest flex items-center gap-2">
                      <Clock size={14} className="text-blue-400" /> EDIT HISTORY
                    </h3>
                    <div className="space-y-4">
                      {selectedSkill.editHistory.map((hist, i) => (
                        <div key={i} className="flex flex-col gap-1 text-sm border-l-2 border-slate-800 pl-3">
                          <span className="text-slate-500 text-xs font-bold tracking-wider">{new Date(hist.timestamp).toLocaleString([], {dateStyle:'short', timeStyle:'short'})}</span>
                          <span className="text-slate-300">{hist.changeDescription}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-slate-900/50 p-5 rounded-xl border border-fuchsia-900/30 shadow-inner">
                <h3 className="text-xs font-bold text-fuchsia-500/70 mb-4 tracking-widest flex items-center gap-2">
                  <Terminal size={14} className="text-emerald-400" /> IMPLEMENTATION (CODE / PROMPT)
                </h3>
                <pre className="bg-slate-950 border border-slate-800/80 rounded-lg p-4 text-emerald-400/90 whitespace-pre-wrap font-mono text-xs leading-relaxed shadow-inner overflow-x-auto">
                  {selectedSkill.code || selectedSkill.promptTemplate || '// No implementation provided'}
                </pre>
              </div>
            </motion.div>
          ) : (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex items-center justify-center text-slate-600 text-sm tracking-widest font-bold"
            >
              [ SELECT A SKILL TO INSPECT ]
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
