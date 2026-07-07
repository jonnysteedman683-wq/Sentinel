import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';
import { runConsolidationJob } from './consolidator';
import { Database, Search, Activity, Zap, Clock, Tag, Network, PieChart, Layers, Box, History, Flame } from 'lucide-react';
import { MemoryGraph } from './MemoryGraph';
import { MemoryStats } from './MemoryStats';
import { MemoryPalace } from './MemoryPalace';
import { TemporalRewind } from './TemporalRewind';
import { CognitiveHeatmap } from './CognitiveHeatmap';
import Markdown from 'react-markdown';
import { motion, AnimatePresence } from 'motion/react';
import { useSentinel } from './SentinelContext';

export function MemoryPanel() {
  const [searchTerm, setSearchTerm] = useState('');
  const [tab, setTab] = useState<'episodic' | 'semantic' | 'graph' | 'palace' | 'rewind' | 'stats' | 'heatmap'>('semantic');
  const [isConsolidating, setIsConsolidating] = useState(false);

  const { setBreadcrumbs } = useSentinel();
  React.useEffect(() => {
    const tabLabels: Record<string, string> = {
      'episodic': 'EPISODIC LOGS',
      'semantic': 'SEMANTIC GRAPH',
      'graph': 'KNOWLEDGE NETWORK',
      'palace': 'MEMORY PALACE',
      'rewind': 'TEMPORAL REWIND',
      'stats': 'SYSTEM STATS',
      'heatmap': 'COGNITIVE HEATMAP'
    };
    setBreadcrumbs([{ label: tabLabels[tab] || tab.toUpperCase() }]);
  }, [tab, setBreadcrumbs]);


  const episodes = useLiveQuery(
    () => db.episodes.orderBy('timestamp').reverse().limit(100).toArray(),
    []
  );

  const semanticEntries = useLiveQuery(
    () => db.semanticEntries.orderBy('timestamp').reverse().toArray(),
    []
  );

  const handleConsolidate = async () => {
    setIsConsolidating(true);
    await runConsolidationJob();
    setIsConsolidating(false);
  };

  const filteredEpisodes = episodes?.filter(ep => 
    ep.content.toLowerCase().includes(searchTerm.toLowerCase()) || 
    ep.tags.some(t => t.toLowerCase().includes(searchTerm.toLowerCase()))
  ) || [];

  const filteredSemantic = semanticEntries?.filter(se => 
    se.content.toLowerCase().includes(searchTerm.toLowerCase()) || 
    se.tags.some(t => t.toLowerCase().includes(searchTerm.toLowerCase()))
  ) || [];

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-300 font-mono text-sm border-r border-slate-800">
      <div className="p-4 border-b border-slate-800/50 bg-slate-900/50 backdrop-blur flex justify-between items-center z-10 shadow-sm">
        <div className="flex items-center gap-3 text-blue-400 font-bold tracking-widest">
          <div className="p-1.5 bg-blue-500/10 rounded border border-blue-500/20">
            <Database size={16} />
          </div>
          <span>MEMORY INSPECTOR</span>
        </div>
        <button 
          onClick={handleConsolidate}
          disabled={isConsolidating}
          className="flex items-center gap-2 bg-blue-600/90 hover:bg-blue-500 text-white border border-blue-500/50 rounded-lg px-4 py-2 text-xs font-bold shadow-[0_0_15px_rgba(59,130,246,0.2)] disabled:opacity-50 transition-all"
        >
          <Zap size={14} className={isConsolidating ? 'animate-pulse text-amber-300' : ''} />
          {isConsolidating ? 'CONSOLIDATING...' : 'CONSOLIDATE NOW'}
        </button>
      </div>
      
      <div className="p-4 border-b border-slate-800/50 bg-slate-900/30 space-y-4">
        <div className="flex gap-2">
          {[
            { id: 'semantic', label: `SEMANTIC (${semanticEntries?.length || 0})`, icon: Layers },
            { id: 'episodic', label: `EPISODIC (${episodes?.length || 0})`, icon: Activity },
            { id: 'graph', label: 'GRAPH', icon: Network },
            { id: 'palace', label: '3D PALACE', icon: Box },
            { id: 'rewind', label: 'REWIND', icon: History },
            { id: 'stats', label: 'STATS', icon: PieChart },
            { id: 'heatmap', label: 'HEATMAP', icon: Flame }
          ].map(t => (
            <button 
              key={t.id}
              onClick={() => setTab(t.id as any)}
              className={`flex-1 py-2 text-center rounded-lg transition-all flex items-center justify-center gap-2 text-xs font-bold tracking-widest ${
                tab === t.id 
                  ? 'bg-slate-800 text-blue-400 shadow-inner border border-slate-700/50' 
                  : 'bg-transparent text-slate-500 hover:text-slate-300 hover:bg-slate-800/30 border border-transparent'
              }`}
            >
              <t.icon size={14} /> <span className="hidden sm:inline">{t.label}</span>
            </button>
          ))}
        </div>
        
        <div className="relative">
          <Search size={16} className="absolute left-3 top-3 text-slate-500" />
          <input
            type="text"
            placeholder="Search memory fabric..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700/80 rounded-lg pl-10 pr-4 py-2.5 focus:outline-none focus:border-blue-500/70 focus:ring-1 focus:ring-blue-500/50 text-slate-200 placeholder-slate-600 shadow-inner transition-all"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 scroll-smooth">
        <AnimatePresence mode="wait">
          <motion.div 
            key={tab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="h-full"
          >
            {tab === 'graph' && (
              <div className="h-full flex flex-col">
                <div className="text-xs font-bold tracking-widest text-slate-500 mb-3 flex justify-between items-center">
                  <span>MEMORY ASSOCIATION GRAPH</span>
                  <span className="text-blue-500 px-2 py-1 bg-blue-500/10 rounded-full border border-blue-500/20">SIMILARITY &gt; 0.5</span>
                </div>
                <div className="flex-1 min-h-[400px] border border-slate-800 rounded-xl overflow-hidden shadow-inner bg-slate-900/50">
                  <MemoryGraph episodes={episodes || []} semanticEntries={semanticEntries || []} />
                </div>
                <div className="flex gap-6 mt-4 text-[10px] font-bold tracking-widest text-slate-500 justify-center">
                  <span className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]"></div> SEMANTIC</span>
                  <span className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-indigo-400 shadow-[0_0_8px_rgba(129,140,248,0.5)]"></div> USER</span>
                  <span className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]"></div> AGENT</span>
                </div>
              </div>
            )}

            {tab === 'stats' && (
              <div className="h-full flex flex-col">
                <MemoryStats episodes={episodes || []} semanticEntries={semanticEntries || []} />
              </div>
            )}

            {tab === 'heatmap' && (
              <div className="h-full flex flex-col">
                <CognitiveHeatmap episodes={episodes || []} semanticEntries={semanticEntries || []} />
              </div>
            )}

            {tab === 'palace' && (
              <div className="h-full flex flex-col">
                <MemoryPalace episodes={episodes || []} semanticEntries={semanticEntries || []} />
              </div>
            )}

            {tab === 'rewind' && (
              <div className="h-full flex flex-col">
                <TemporalRewind episodes={episodes || []} />
              </div>
            )}

            {tab === 'episodic' && (
              <div className="space-y-4">
                {filteredEpisodes.map(ep => (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    key={ep.id} 
                    className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-5 hover:border-slate-700/80 transition-colors shadow-sm"
                  >
                    <div className="flex justify-between items-start mb-3 border-b border-slate-800/50 pb-3">
                      <div className="flex items-center gap-2 text-xs font-bold tracking-widest text-slate-400">
                        <Activity size={14} />
                        <span className={ep.type === 'user' ? 'text-indigo-400' : ep.type === 'agent' ? 'text-emerald-400' : 'text-rose-400'}>
                          {ep.type.toUpperCase()} EPISODE
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 font-bold tracking-wider">
                        <Clock size={12} />
                        {new Date(ep.timestamp).toLocaleString([], {dateStyle:'short', timeStyle:'short'})}
                      </div>
                    </div>
                    <div className="markdown-body prose prose-invert prose-sm max-w-none mb-4 prose-p:leading-relaxed text-slate-300">
                      <Markdown>{ep.content}</Markdown>
                    </div>
                    {ep.tags.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {ep.tags.map((tag, i) => (
                          <span key={i} className="flex items-center gap-1.5 bg-slate-950 text-slate-400 px-2.5 py-1 rounded-md text-[10px] font-bold tracking-widest uppercase border border-slate-800">
                            <Tag size={10} /> {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            )}

            {tab === 'semantic' && (
              <div className="space-y-4">
                {filteredSemantic.map(se => (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    key={se.id} 
                    className="bg-blue-950/20 border border-blue-900/40 rounded-xl p-5 hover:border-blue-800/60 transition-colors shadow-[0_0_15px_rgba(59,130,246,0.03)] relative overflow-hidden"
                  >
                    <div className="absolute top-0 left-0 w-1 h-full bg-blue-500/50 rounded-l-xl"></div>
                    <div className="flex justify-between items-start mb-3 border-b border-blue-900/30 pb-3 pl-2">
                      <div className="flex items-center gap-2 text-xs font-bold tracking-widest text-blue-400">
                        <Database size={14} />
                        <span>DISTILLED FACT</span>
                      </div>
                      <div className="flex items-center gap-4 text-xs font-bold tracking-wider text-slate-500">
                        <span className="text-blue-400/80 bg-blue-950 px-2 py-0.5 rounded border border-blue-900/50" title="Retrieval Count">HITS: {se.retrievalCount}</span>
                        <div className="flex items-center gap-1.5">
                          <Clock size={12} />
                          {new Date(se.timestamp).toLocaleString([], {dateStyle:'short', timeStyle:'short'})}
                        </div>
                      </div>
                    </div>
                    <div className="markdown-body prose prose-invert prose-blue prose-sm max-w-none mb-4 pl-2 text-slate-200">
                      <Markdown>{se.content}</Markdown>
                    </div>
                    {se.tags.length > 0 && (
                      <div className="flex flex-wrap gap-2 pl-2">
                        {se.tags.map((tag, i) => (
                          <span key={i} className="flex items-center gap-1.5 bg-blue-950/50 text-blue-400 px-2.5 py-1 rounded-md text-[10px] font-bold tracking-widest uppercase border border-blue-900/60">
                            <Tag size={10} /> {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            )}

            {((tab === 'episodic' && filteredEpisodes.length === 0) || (tab === 'semantic' && filteredSemantic.length === 0)) && (
              <div className="text-center text-slate-600 py-20 text-xs tracking-widest font-bold">
                [ NO MEMORIES FOUND MATCHING CRITERIA ]
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
