import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Brain, X, Zap } from 'lucide-react';

export interface Memory {
  id: string;
  text: string;
  tags: string[];
  strength: number;
}

interface Props {
  memory: Memory | null;
  onUse: (text: string) => void;
  onDismiss: () => void;
  onTimeout: () => void;
}

export const MemoryNudge: React.FC<Props> = ({ memory, onUse, onDismiss, onTimeout }) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!memory) {
      setVisible(false);
      return;
    }
    setVisible(true);

    const timer = setTimeout(() => {
      setVisible(false);
      onTimeout();
    }, 20000); // 20 seconds auto-dismiss

    return () => clearTimeout(timer);
  }, [memory, onTimeout]);

  if (!memory) return null;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          id="memory-nudge-container"
          initial={{ opacity: 0, y: 50, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 30, scale: 0.95 }}
          transition={{ type: 'spring', damping: 20, stiffness: 120 }}
          className="fixed bottom-6 right-6 z-50 bg-slate-900/90 backdrop-blur-md border border-teal-500/30 rounded-xl p-4 shadow-[0_0_25px_rgba(20,184,166,0.15)] max-w-sm w-full"
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5 text-teal-400">
              <Brain className="w-4 h-4 animate-pulse text-teal-400" />
              <span className="text-[10px] font-bold uppercase tracking-widest font-mono">Neural Memory Nudge</span>
            </div>
            <button
              id="close-nudge-btn"
              onClick={() => {
                setVisible(false);
                onDismiss();
              }}
              className="text-slate-400 hover:text-white p-1 rounded hover:bg-white/5 transition"
              title="Dismiss memory nudge"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Memory Text */}
          <p className="text-xs text-slate-200 line-clamp-3 mb-3 leading-relaxed font-sans">
            "{memory.text}"
          </p>

          {/* Tags */}
          {memory.tags && memory.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-4">
              {memory.tags.slice(0, 3).map((tag, i) => (
                <span key={i} className="text-[9px] uppercase tracking-wider font-mono font-semibold px-1.5 py-0.5 rounded bg-teal-500/10 text-teal-300 border border-teal-500/10">
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2">
            <button
              id="use-nudge-btn"
              onClick={() => {
                setVisible(false);
                onUse(memory.text);
              }}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold rounded-lg transition-all shadow-[0_2px_10px_rgba(20,184,166,0.2)] active:scale-95"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Recall to Input</span>
            </button>
            <button
              id="dismiss-nudge-btn"
              onClick={() => {
                setVisible(false);
                onDismiss();
              }}
              className="px-3 py-2 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium rounded-lg transition active:scale-95 border border-slate-700"
            >
              Dismiss
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
