import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useMotionValue, animate } from 'motion/react';
import { Activity, Cpu, Database, Fingerprint, Network, Shield, Zap, Terminal, Globe, Server, RefreshCw, Link2 } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';

function SwarmNode({ 
  model, 
  initialPos, 
  onPositionChange, 
  snapToGrid,
  linkMode,
  isSelected,
  onClick
}: { 
  model: any, 
  initialPos: { x: number, y: number }, 
  onPositionChange: (id: string, x: number, y: number) => void, 
  snapToGrid?: boolean,
  linkMode?: boolean,
  isSelected?: boolean,
  onClick?: () => void
}) {
  const x = useMotionValue(initialPos.x || 0);
  const y = useMotionValue(initialPos.y || 0);

  return (
    <motion.div
      id={`node-${model.id}`}
      drag={!linkMode}
      dragMomentum={false}
      style={{ x, y }}
      onClick={onClick}
      onDragEnd={() => {
        let finalX = x.get();
        let finalY = y.get();
        if (snapToGrid) {
          finalX = Math.round(finalX / 50) * 50;
          finalY = Math.round(finalY / 50) * 50;
          animate(x, finalX, { type: 'spring', bounce: 0, duration: 0.2 });
          animate(y, finalY, { type: 'spring', bounce: 0, duration: 0.2 });
        }
        onPositionChange(model.id, finalX, finalY);
      }}
      className={`relative group flex flex-col items-center justify-center z-10 ${linkMode ? 'cursor-pointer' : ''}`}
      whileHover={{ zIndex: 50 }}
      whileDrag={{ zIndex: 50, scale: 1.05 }}
    >
      {isSelected && (
        <span className="absolute -inset-2 rounded-full border border-cyan-400/50 animate-ping pointer-events-none"></span>
      )}
      <motion.div
        animate={{
          scale: model.status === 'Active' ? [1, 1.05, 1] : 1,
          boxShadow: model.status === 'Active' 
            ? `0 0 15px currentColor` 
            : '0 0 0px transparent'
        }}
        transition={{ duration: 2, repeat: Infinity }}
        className={`w-16 h-16 rounded-full border-2 ${model.border} ${model.bg} ${model.color} flex items-center justify-center relative transition-colors shadow-lg ${linkMode ? 'cursor-pointer hover:border-cyan-500' : 'cursor-grab active:cursor-grabbing'} ${isSelected ? 'ring-2 ring-cyan-400 ring-offset-2 ring-offset-slate-900' : ''}`}
      >
        <Cpu size={24} />
        {model.status === 'Active' && (
          <span className="absolute top-0 right-0 w-3 h-3 rounded-full bg-emerald-500 border border-slate-900 animate-pulse"></span>
        )}
      </motion.div>

      {/* Tooltip */}
      <div 
        className="absolute bottom-full left-1/2 -translate-x-1/2 mb-4 w-48 opacity-0 group-hover:opacity-100 group-hover:-translate-y-2 translate-y-0 pointer-events-none transition-all z-20"
      >
        <div className="bg-slate-900 border border-slate-700 p-4 rounded-xl shadow-xl">
          <div className={`text-xs font-bold tracking-widest uppercase mb-1 ${model.color}`}>{model.name}</div>
          <div className="text-[10px] text-slate-400 mb-3 border-b border-slate-800 pb-2">{model.role}</div>
          
          <div className="space-y-2 text-[10px] font-mono">
            <div className="flex justify-between">
              <span className="text-slate-500">STATUS</span>
              <span className={model.status === 'Active' ? 'text-emerald-400' : 'text-slate-300'}>{model.status}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">PRIORITY</span>
              <span className="text-slate-300">{model.priority}</span>
            </div>
            <div className="flex justify-between items-center gap-2">
              <span className="text-slate-500">LOAD</span>
              <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden relative">
                <div 
                  className={`absolute top-0 left-0 h-full bg-current ${model.color}`} 
                  style={{ width: `${model.load}%` }}
                ></div>
              </div>
              <span className="text-slate-300 w-6 text-right">{Math.round(model.load)}%</span>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export function NexusPanel() {
  const episodesCount = useLiveQuery(() => db.episodes.count(), []);
  const semanticCount = useLiveQuery(() => db.semanticEntries.count(), []);
  const skillsCount = useLiveQuery(() => db.skills.count(), []);
  const pendingActions = useLiveQuery(() => db.actions.where('status').equals('pending').count(), []);
  const currentIdentity = useLiveQuery(async () => {
    const identities = await db.identities.toArray();
    return identities[identities.length - 1];
  });

  const [activityLevels, setActivityLevels] = useState<number[]>(Array.from({ length: 24 }, () => Math.random() * 80 + 20));
  const [sysLogs, setSysLogs] = useState<{id: number, text: string, type: 'info'|'warn'|'success'}[]>([
    { id: 1, text: 'Kernel initialized. Sub-routines active.', type: 'info' },
    { id: 2, text: 'Memory graph consolidated successfully.', type: 'success' }
  ]);

  const [swarmModels, setSwarmModels] = useState([
    { id: 'proposer', name: 'Proposer (Flash)', role: 'Action Generation', priority: 'High', status: 'Idle', load: 12, color: 'text-indigo-400', bg: 'bg-indigo-500/10', border: 'border-indigo-500/30' },
    { id: 'evaluator', name: 'Risk Assessor (Pro)', role: 'Safety & Tiering', priority: 'Critical', status: 'Active', load: 85, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' },
    { id: 'visionary', name: 'Visionary (Flash)', role: 'Creative Ideation', priority: 'Low', status: 'Standby', load: 2, color: 'text-pink-400', bg: 'bg-pink-500/10', border: 'border-pink-500/30' },
    { id: 'critic', name: 'Critic (Flash)', role: 'Risk Analysis', priority: 'Medium', status: 'Standby', load: 5, color: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/30' },
    { id: 'judge', name: 'Judge (Pro)', role: 'Final Synthesis', priority: 'High', status: 'Idle', load: 10, color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30' },
  ]);

  const [swarmPositions, setSwarmPositions] = useState<Record<string, {x: number, y: number}>>(() => {
    try {
      const saved = localStorage.getItem('nexus-swarm-positions');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const [snapToGrid, setSnapToGrid] = useState(false);
  const [linkMode, setLinkMode] = useState(false);
  const [linkSource, setLinkSource] = useState<string | null>(null);
  
  const [swarmLinks, setSwarmLinks] = useState<{source: string, target: string}[]>(() => {
    try {
      const saved = localStorage.getItem('nexus-swarm-links');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const handleNodeClick = (id: string) => {
    if (!linkMode) return;
    
    if (linkSource === id) {
      setLinkSource(null);
    } else if (linkSource) {
      setSwarmLinks(prev => {
        const exists = prev.find(l => (l.source === linkSource && l.target === id) || (l.source === id && l.target === linkSource));
        let updated;
        if (exists) {
           updated = prev.filter(l => l !== exists);
        } else {
           updated = [...prev, {source: linkSource, target: id}];
        }
        localStorage.setItem('nexus-swarm-links', JSON.stringify(updated));
        return updated;
      });
      setLinkSource(null);
    } else {
      setLinkSource(id);
    }
  };

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let frame: number;
    const updateLines = () => {
      if (!containerRef.current) return;
      const containerRect = containerRef.current.getBoundingClientRect();
      
      swarmLinks.forEach(link => {
        const sourceEl = document.getElementById(`node-${link.source}`);
        const targetEl = document.getElementById(`node-${link.target}`);
        const pathEl = document.getElementById(`link-${link.source}-${link.target}`);
        
        if (sourceEl && targetEl && pathEl) {
           const sRect = sourceEl.getBoundingClientRect();
           const tRect = targetEl.getBoundingClientRect();
           
           const sx = sRect.left - containerRect.left + sRect.width / 2;
           const sy = sRect.top - containerRect.top + sRect.height / 2;
           const tx = tRect.left - containerRect.left + tRect.width / 2;
           const ty = tRect.top - containerRect.top + tRect.height / 2;
           
           pathEl.setAttribute('x1', sx.toString());
           pathEl.setAttribute('y1', sy.toString());
           pathEl.setAttribute('x2', tx.toString());
           pathEl.setAttribute('y2', ty.toString());
        }
      });
      frame = requestAnimationFrame(updateLines);
    };
    frame = requestAnimationFrame(updateLines);
    return () => cancelAnimationFrame(frame);
  }, [swarmLinks, swarmPositions]); // Also re-bind when positions change just in case, though rAF loop handles it

  const handlePositionChange = (id: string, x: number, y: number) => {
    setSwarmPositions(prev => {
      const updated = { ...prev, [id]: { x, y } };
      localStorage.setItem('nexus-swarm-positions', JSON.stringify(updated));
      return updated;
    });
  };

  useEffect(() => {
    const interval = setInterval(() => {
      setActivityLevels(prev => {
        const next = [...prev.slice(1), Math.random() * 80 + 20];
        return next;
      });

      setSwarmModels(prev => prev.map(model => ({
        ...model,
        load: Math.max(0, Math.min(100, model.load + (Math.random() * 20 - 10))),
        status: Math.random() > 0.8 ? (Math.random() > 0.5 ? 'Active' : 'Idle') : model.status
      })));
      
      // Randomly push a log
      if (Math.random() > 0.7) {
        const messages = [
          'Scanning for contextual drift...',
          'Optimizing neural pathways...',
          'Indexing new episodic fragments...',
          'Running background tool diagnostics...',
          'Awaiting asynchronous uplink...',
          'Evaluating autonomy thresholds...'
        ];
        const types: ('info'|'warn'|'success')[] = ['info', 'info', 'success', 'warn'];
        
        setSysLogs(prev => {
          const newLog = { 
            id: Date.now(), 
            text: messages[Math.floor(Math.random() * messages.length)], 
            type: types[Math.floor(Math.random() * types.length)] 
          };
          return [...prev.slice(-4), newLog];
        });
      }
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const stats = [
    { label: 'EPISODIC LOGS', value: episodesCount || 0, icon: Activity, color: 'text-indigo-400', bg: 'bg-indigo-500/10', border: 'border-indigo-500/30' },
    { label: 'SEMANTIC FACTS', value: semanticCount || 0, icon: Database, color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/30' },
    { label: 'DISTILLED SKILLS', value: skillsCount || 0, icon: Terminal, color: 'text-fuchsia-400', bg: 'bg-fuchsia-500/10', border: 'border-fuchsia-500/30' },
    { label: 'PENDING ACTIONS', value: pendingActions || 0, icon: Shield, color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30' },
  ];

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-300 font-sans relative overflow-hidden">
      {/* Background ambient effect */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-emerald-900/10 blur-[120px] animate-pulse" style={{ animationDuration: '8s' }}></div>
        <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] rounded-full bg-blue-900/10 blur-[150px] animate-pulse" style={{ animationDuration: '12s' }}></div>
      </div>

      <div className="p-4 md:p-6 border-b border-slate-800/50 bg-slate-900/50 backdrop-blur flex justify-between items-center z-10 shadow-sm relative">
        <div className="flex items-center gap-3 text-emerald-400 font-bold tracking-[0.2em] uppercase">
          <div className="p-1.5 bg-emerald-500/10 rounded-lg border border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.15)]">
            <Globe size={18} />
          </div>
          <span className="font-display text-lg">System Nexus</span>
        </div>
        <div className="text-xs text-emerald-500 font-bold tracking-widest px-3 py-1 bg-emerald-950/30 rounded-full border border-emerald-900/50 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
          ONLINE
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8 scroll-smooth relative z-10">
        <div className="max-w-6xl mx-auto space-y-8">
          
          {/* Hero Section */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-8 relative overflow-hidden shadow-xl"
          >
            <div className="absolute top-0 right-0 p-8 opacity-5"><Cpu size={150} /></div>
            <div className="relative z-10 flex flex-col md:flex-row gap-8 items-center md:items-start">
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-emerald-500 to-blue-600 p-1 shadow-[0_0_30px_rgba(16,185,129,0.2)] shrink-0 relative group">
                <div className="w-full h-full bg-slate-950 rounded-full flex items-center justify-center relative overflow-hidden">
                   <div className="absolute inset-0 bg-emerald-500/10 group-hover:bg-emerald-500/20 transition-colors"></div>
                  <Cpu size={40} className="text-emerald-400 relative z-10" />
                </div>
              </div>
              <div className="text-center md:text-left flex-1">
                <h1 className="text-4xl font-bold text-white mb-2 font-display tracking-tight flex items-center gap-3 justify-center md:justify-start">
                  Sentinel Agent <span className="text-xs font-mono bg-slate-800 text-slate-400 px-2 py-1 rounded-md border border-slate-700 align-middle">v1.0.0-alpha</span>
                </h1>
                <p className="text-slate-400 text-lg leading-relaxed max-w-2xl">
                  {currentIdentity?.relationshipContext || "A persistent, self-improving cognitive agent operating in the background, learning from your interactions and managing proactive tasks."}
                </p>
                <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 mt-6">
                  <div className="flex items-center gap-2 text-xs font-bold tracking-widest text-purple-400 bg-purple-950/30 px-3 py-1.5 rounded-lg border border-purple-900/50">
                    <Fingerprint size={14} /> CORE IDENTITY
                  </div>
                  <div className="flex items-center gap-2 text-xs font-bold tracking-widest text-emerald-400 bg-emerald-950/30 px-3 py-1.5 rounded-lg border border-emerald-900/50">
                    <Zap size={14} /> ACTIVE KERNEL
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {stats.map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.1 }}
                className={`bg-slate-900/40 border ${stat.border} p-6 rounded-2xl flex flex-col gap-4 relative overflow-hidden group hover:border-current/80 transition-all shadow-inner`}
              >
                <div className={`absolute top-0 right-0 w-24 h-24 ${stat.bg} rounded-bl-[100px] -z-10 transition-transform group-hover:scale-110`}></div>
                <div className="flex justify-between items-start">
                  <div className={`p-3 rounded-xl ${stat.bg} ${stat.color} border border-current/20 shadow-sm`}>
                    <stat.icon size={24} />
                  </div>
                </div>
                <div>
                  <div className="text-4xl font-bold text-white mb-1 tracking-tight font-display">{stat.value}</div>
                  <div className="text-xs font-bold tracking-widest text-slate-500">{stat.label}</div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Swarm Cluster */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-slate-900/40 border border-slate-800/80 p-6 rounded-2xl shadow-inner"
          >
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-sm font-bold text-slate-400 tracking-widest flex items-center gap-2 uppercase">
                <Network size={16} className="text-purple-400" /> Swarm Intelligence Cluster
              </h3>
              <div className="flex items-center gap-4">
                <button
                  onClick={() => {
                    setLinkMode(!linkMode);
                    if (linkMode) setLinkSource(null);
                  }}
                  className={`text-xs font-bold tracking-widest px-3 py-1.5 rounded-lg border transition-all flex items-center gap-2 ${
                    linkMode 
                      ? 'bg-cyan-900/30 text-cyan-400 border-cyan-500/30 shadow-[0_0_10px_rgba(34,211,238,0.2)]'
                      : 'bg-slate-800/50 text-slate-500 border-slate-700/50 hover:bg-slate-800 hover:text-slate-400'
                  }`}
                >
                  <Link2 size={14} />
                  LINK MODE
                </button>
                <button
                  onClick={() => setSnapToGrid(!snapToGrid)}
                  className={`text-xs font-bold tracking-widest px-3 py-1.5 rounded-lg border transition-all flex items-center gap-2 ${
                    snapToGrid 
                      ? 'bg-purple-900/30 text-purple-400 border-purple-500/30 shadow-[0_0_10px_rgba(168,85,247,0.2)]'
                      : 'bg-slate-800/50 text-slate-500 border-slate-700/50 hover:bg-slate-800 hover:text-slate-400'
                  }`}
                >
                  <div className={`w-2 h-2 rounded-full ${snapToGrid ? 'bg-purple-400 shadow-[0_0_5px_currentColor]' : 'bg-slate-600'}`}></div>
                  SNAP TO GRID
                </button>
              </div>
            </div>
            <div ref={containerRef} className="flex flex-wrap gap-8 justify-center min-h-[120px] p-4 relative">
              <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
                {swarmLinks.map(link => (
                  <line 
                    key={`${link.source}-${link.target}`}
                    id={`link-${link.source}-${link.target}`}
                    stroke="currentColor" 
                    strokeWidth="2"
                    className="text-cyan-500/50"
                    strokeDasharray="4 4"
                  />
                ))}
              </svg>
              {swarmModels.map((model) => (
                <SwarmNode 
                  key={model.id} 
                  model={model} 
                  initialPos={swarmPositions[model.id] || { x: 0, y: 0 }}
                  onPositionChange={handlePositionChange}
                  snapToGrid={snapToGrid}
                  linkMode={linkMode}
                  isSelected={linkSource === model.id}
                  onClick={() => handleNodeClick(model.id)}
                />
              ))}
            </div>
          </motion.div>

          {/* Activity / Connectivity / Logs */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
              className="lg:col-span-2 bg-slate-900/40 border border-slate-800/80 p-6 rounded-2xl shadow-inner flex flex-col"
            >
              <h3 className="text-sm font-bold text-slate-400 mb-6 tracking-widest flex items-center gap-2 uppercase">
                <Network size={16} className="text-blue-400" /> Neural Activity Monitor
              </h3>
              <div className="h-48 flex items-end gap-1 flex-1">
                {activityLevels.map((val, i) => (
                  <div key={i} className="flex-1 bg-slate-800/50 rounded-t-sm relative group overflow-hidden">
                    <motion.div 
                      className="absolute bottom-0 w-full bg-blue-500/70 rounded-t-sm"
                      animate={{ height: `${val}%` }}
                      transition={{ type: "tween", duration: 0.5 }}
                    ></motion.div>
                  </div>
                ))}
              </div>
              <div className="flex justify-between mt-4 text-[10px] font-bold tracking-widest text-slate-600">
                <span>T-24S</span>
                <span>NOW</span>
              </div>
            </motion.div>

            <div className="space-y-6 flex flex-col h-full">
              <motion.div 
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 }}
                className="bg-slate-900/40 border border-slate-800/80 p-6 rounded-2xl shadow-inner flex-1 flex flex-col"
              >
                <h3 className="text-sm font-bold text-slate-400 mb-4 tracking-widest flex items-center gap-2 uppercase">
                  <Server size={16} className="text-emerald-400" /> System Telemetry
                </h3>
                <div className="flex-1 bg-slate-950/80 rounded-xl p-4 font-mono text-[10px] overflow-hidden flex flex-col justify-end gap-2 border border-slate-800 shadow-inner">
                  <AnimatePresence>
                    {sysLogs.map(log => (
                      <motion.div 
                        key={log.id}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        className={`p-2 rounded border ${
                          log.type === 'info' ? 'bg-blue-900/10 border-blue-500/20 text-blue-400' :
                          log.type === 'warn' ? 'bg-amber-900/10 border-amber-500/20 text-amber-400' :
                          'bg-emerald-900/10 border-emerald-500/20 text-emerald-400'
                        }`}
                      >
                        <span className="opacity-50 mr-2">[{new Date(log.id).toLocaleTimeString([], {hour12: false, second: '2-digit'})}]</span>
                        {log.text}
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </motion.div>
              
              <motion.div 
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 }}
                className="bg-slate-900/40 border border-slate-800/80 p-5 rounded-2xl shadow-inner flex justify-between items-center"
              >
                <div className="flex items-center gap-3">
                  <Shield size={16} className="text-slate-400" />
                  <span className="text-xs font-bold tracking-widest text-slate-400">SANDBOX STATUS</span>
                </div>
                <span className="text-[10px] font-bold text-emerald-500 tracking-widest bg-emerald-950/30 px-2 py-1 rounded border border-emerald-900/50 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  SECURE
                </span>
              </motion.div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
