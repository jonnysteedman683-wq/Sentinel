import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Clock, Play, Brain, ShieldAlert, CheckCircle2, Zap, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { auth } from '../firebase.js';

interface Episode {
  id: string;
  timestamp: number;
  trigger: string;
  context: Record<string, any>;
  actionsTaken: string[];
  outcome: 'success' | 'failure' | 'neutral' | 'partial';
  reward: number;
  emotionalState?: { v: number; a: number; d: number };
}

export function EpisodeTimeline() {
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    const fetchTimeline = async () => {
      try {
        const token = auth.currentUser ? await auth.currentUser.getIdToken() : '';
        const res = await fetch('/api/episodes/timeline', {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.episodes) {
          setEpisodes(data.episodes);
        }
      } catch (e) {
        console.error('Failed to fetch episodes:', e);
      } finally {
        setLoading(false);
      }
    };
    fetchTimeline();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8 text-slate-500">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  if (episodes.length === 0) {
    return (
      <div className="p-8 text-center text-slate-500 font-mono text-sm border border-slate-800/50 rounded-xl bg-slate-900/20">
        No episodic memories synthesized yet. The system will create episodes during autonomous action and high-surprise events.
      </div>
    );
  }

  const getOutcomeColor = (outcome: string) => {
    switch (outcome) {
      case 'success': return 'text-emerald-400 border-emerald-400/20 bg-emerald-400/10';
      case 'failure': return 'text-red-400 border-red-400/20 bg-red-400/10';
      case 'partial': return 'text-amber-400 border-amber-400/20 bg-amber-400/10';
      default: return 'text-slate-400 border-slate-400/20 bg-slate-400/10';
    }
  };

  const getOutcomeIcon = (outcome: string) => {
    switch (outcome) {
      case 'success': return <CheckCircle2 className="w-3 h-3" />;
      case 'failure': return <ShieldAlert className="w-3 h-3" />;
      case 'partial': return <Zap className="w-3 h-3" />;
      default: return <Brain className="w-3 h-3" />;
    }
  };

  return (
    <div className="relative pl-6 border-l border-slate-800 space-y-6">
      {episodes.map((ep, idx) => {
        const isExpanded = expandedId === ep.id;
        const date = new Date(ep.timestamp);
        
        return (
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.05 }}
            key={ep.id}
            className="relative"
          >
            {/* Timeline node */}
            <div className="absolute -left-[31px] top-1.5 w-3 h-3 rounded-full bg-violet-500 ring-4 ring-gray-950" />
            
            <div 
              className={`rounded-xl border transition-all duration-300 ${
                isExpanded ? 'border-violet-500/40 bg-violet-950/10' : 'border-slate-800/60 bg-slate-900/40 hover:border-slate-700/60 hover:bg-slate-900/60'
              }`}
            >
              <button 
                onClick={() => setExpandedId(isExpanded ? null : ep.id)}
                className="w-full flex items-start gap-4 p-4 text-left"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1.5">
                    <Clock className="w-3.5 h-3.5 text-slate-500" />
                    <span className="text-xs text-slate-500 font-mono">
                      {date.toLocaleDateString()} {date.toLocaleTimeString()}
                    </span>
                    <span className={`flex items-center gap-1 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border ${getOutcomeColor(ep.outcome)} ml-auto`}>
                      {getOutcomeIcon(ep.outcome)} {ep.outcome}
                    </span>
                  </div>
                  <h4 className="text-sm font-semibold text-slate-200">{ep.trigger}</h4>
                  
                  {!isExpanded && ep.actionsTaken?.length > 0 && (
                    <div className="mt-2 text-xs text-slate-500 font-mono">
                      Actions: {ep.actionsTaken.join(', ')}
                    </div>
                  )}
                </div>
                {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
              </button>

              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden border-t border-slate-800/60"
                  >
                    <div className="p-4 space-y-4">
                      {ep.actionsTaken?.length > 0 && (
                        <div>
                          <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1.5">Action Trace</p>
                          <div className="flex flex-wrap gap-2">
                            {ep.actionsTaken.map((act, i) => (
                              <div key={i} className="flex items-center gap-1 bg-slate-800/50 rounded px-2 py-1 text-xs text-slate-300 font-mono">
                                <Play className="w-3 h-3 text-violet-400" /> {act}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {ep.context && Object.keys(ep.context).length > 0 && (
                        <div>
                          <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1.5">Context State</p>
                          <div className="bg-black/30 rounded-lg p-2.5">
                            <pre className="text-[10px] text-slate-400 font-mono leading-relaxed overflow-x-auto">
                              {JSON.stringify(ep.context, null, 2)}
                            </pre>
                          </div>
                        </div>
                      )}

                      <div className="flex items-center gap-4 border-t border-slate-800/60 pt-3">
                        <div className="text-[11px] font-mono">
                          <span className="text-slate-500">Reward: </span>
                          <span className={ep.reward >= 0 ? 'text-emerald-400' : 'text-red-400'}>{ep.reward?.toFixed(4) || '0.0000'}</span>
                        </div>
                        {ep.emotionalState && (
                          <div className="text-[11px] font-mono">
                            <span className="text-slate-500">VAD: </span>
                            <span className="text-indigo-300">[{ep.emotionalState.v.toFixed(2)}, {ep.emotionalState.a.toFixed(2)}, {ep.emotionalState.d.toFixed(2)}]</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
