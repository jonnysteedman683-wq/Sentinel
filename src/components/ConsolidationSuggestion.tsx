import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, X, BrainCircuit } from 'lucide-react';

export interface ConsolidationProposal {
  chatId: string;
  summary: string;
  tags: string[];
  confidence: number;
}

interface Props {
  proposal: ConsolidationProposal | null;
  onConfirm: (proposal: ConsolidationProposal) => void;
  onDismiss: () => void;
  onTimeout: () => void;
}

export const ConsolidationSuggestion: React.FC<Props> = ({ proposal, onConfirm, onDismiss, onTimeout }) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!proposal) {
      setVisible(false);
      return;
    }
    setVisible(true);

    const timer = setTimeout(() => {
      setVisible(false);
      onTimeout();
    }, 30000); // 30 seconds auto-dismiss

    return () => clearTimeout(timer);
  }, [proposal, onTimeout]);

  if (!proposal) return null;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          id="consolidation-suggestion-container"
          initial={{ opacity: 0, y: 50, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 30, scale: 0.95 }}
          transition={{ type: 'spring', damping: 20, stiffness: 120 }}
          className="fixed bottom-6 left-6 z-50 bg-slate-900/90 backdrop-blur-md border border-purple-500/30 rounded-xl p-4 shadow-[0_0_25px_rgba(168,85,247,0.15)] max-w-sm w-full"
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5 text-purple-400">
              <BrainCircuit className="w-4 h-4 animate-pulse text-purple-400" />
              <span className="text-[10px] font-bold uppercase tracking-widest font-mono">Cognitive Consolidation</span>
            </div>
            <button
              id="close-consolidation-btn"
              onClick={() => {
                setVisible(false);
                onDismiss();
              }}
              className="text-slate-400 hover:text-white p-1 rounded hover:bg-white/5 transition"
              title="Dismiss consolidation suggestion"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Proposal Text */}
          <p className="text-xs text-slate-200 line-clamp-3 mb-3 leading-relaxed font-sans">
            "{proposal.summary}"
          </p>

          {/* Tags & Confidence */}
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            {proposal.tags && proposal.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {proposal.tags.slice(0, 3).map((tag, i) => (
                  <span key={i} className="text-[9px] uppercase tracking-wider font-mono font-semibold px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-300 border border-purple-500/10">
                    {tag}
                  </span>
                ))}
              </div>
            )}
            <span className="text-[9px] font-mono text-slate-400">
              Confidence: {Math.round(proposal.confidence * 100)}%
            </span>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <button
              id="save-consolidation-btn"
              onClick={() => {
                setVisible(false);
                onConfirm(proposal);
              }}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-lg transition-all shadow-[0_2px_10px_rgba(168,85,247,0.2)] active:scale-95 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Consolidate Memory</span>
            </button>
            <button
              id="discard-consolidation-btn"
              onClick={() => {
                setVisible(false);
                onDismiss();
              }}
              className="px-3 py-2 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium rounded-lg transition active:scale-95 border border-slate-700 cursor-pointer"
            >
              Discard
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
