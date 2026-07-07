import React, { useState, useMemo } from 'react';
import { History, Play, Pause, FastForward, Rewind } from 'lucide-react';
import { motion } from 'motion/react';
import Markdown from 'react-markdown';

export function TemporalRewind({ episodes }: { episodes: any[] }) {
  const [isPlaying, setIsPlaying] = useState(false);
  
  // Sort episodes chronologically
  const sortedEpisodes = useMemo(() => {
    return [...episodes].sort((a, b) => a.timestamp - b.timestamp);
  }, [episodes]);

  const [currentIndex, setCurrentIndex] = useState(sortedEpisodes.length - 1);

  const currentEpisode = sortedEpisodes[currentIndex];
  
  const handleScrub = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCurrentIndex(Number(e.target.value));
  };

  return (
    <div className="flex flex-col h-full bg-slate-900/50 rounded-xl border border-slate-800 p-6 shadow-inner relative overflow-hidden">
      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-5 pointer-events-none mix-blend-overlay"></div>
      
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-xs font-bold text-slate-400 tracking-widest uppercase flex items-center gap-2">
          <History size={16} className="text-indigo-400" /> Temporal Simulation
        </h3>
      </div>

      {sortedEpisodes.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-slate-500 font-bold tracking-widest text-xs">
          NO EPISODIC DATA TO SIMULATE
        </div>
      ) : (
        <>
          <div className="flex-1 flex flex-col justify-center max-w-3xl mx-auto w-full gap-8">
            
            <motion.div 
              key={currentEpisode.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-slate-950/80 border border-slate-800 rounded-2xl p-8 shadow-xl relative"
            >
              <div className="absolute -top-3 left-8 bg-indigo-500 text-white text-[10px] font-bold tracking-widest px-3 py-1 rounded-full shadow-[0_0_10px_rgba(99,102,241,0.5)]">
                {new Date(currentEpisode.timestamp).toLocaleString()}
              </div>
              
              <div className="flex items-center gap-3 mb-4">
                <span className={`w-3 h-3 rounded-full ${currentEpisode.type === 'user' ? 'bg-indigo-500' : currentEpisode.type === 'agent' ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                <span className="text-xs font-bold tracking-widest text-slate-500 uppercase">{currentEpisode.type} KERNEL</span>
              </div>
              
              <div className="prose prose-invert prose-indigo max-w-none text-slate-300">
                <Markdown>{currentEpisode.content}</Markdown>
              </div>
            </motion.div>

          </div>

          <div className="mt-8 bg-slate-950 border border-slate-800 rounded-xl p-6 shadow-inner flex flex-col gap-6 relative z-10">
            <div className="flex items-center gap-4">
              <span className="text-xs font-mono text-slate-500">{new Date(sortedEpisodes[0].timestamp).toLocaleDateString()}</span>
              <input 
                type="range" 
                min="0" 
                max={sortedEpisodes.length - 1} 
                value={currentIndex}
                onChange={handleScrub}
                className="flex-1 h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
              />
              <span className="text-xs font-mono text-slate-500">{new Date(sortedEpisodes[sortedEpisodes.length - 1].timestamp).toLocaleDateString()}</span>
            </div>
            
            <div className="flex justify-center items-center gap-6">
              <button onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))} className="text-slate-500 hover:text-indigo-400 transition-colors">
                <Rewind size={24} />
              </button>
              <button 
                onClick={() => setIsPlaying(!isPlaying)}
                className="w-12 h-12 bg-indigo-500/20 text-indigo-400 rounded-full flex items-center justify-center hover:bg-indigo-500/40 transition-colors border border-indigo-500/50 shadow-[0_0_15px_rgba(99,102,241,0.2)]"
              >
                {isPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" className="ml-1" />}
              </button>
              <button onClick={() => setCurrentIndex(Math.min(sortedEpisodes.length - 1, currentIndex + 1))} className="text-slate-500 hover:text-indigo-400 transition-colors">
                <FastForward size={24} />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
