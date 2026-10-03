import React from 'react';
import { GitMerge, CheckCircle, XCircle } from 'lucide-react';

interface DiffViewerProps {
  fileName: string;
  originalCode: string;
  proposedCode: string;
  onApprove: () => void;
  onReject: () => void;
}

export function DiffViewer({ fileName, originalCode, proposedCode, onApprove, onReject }: DiffViewerProps) {
  // Simple diff visualization (mock logic for demo purposes - usually you'd use a diff library)
  const originalLines = originalCode.split('\\n');
  const proposedLines = proposedCode.split('\\n');
  
  const maxLength = Math.max(originalLines.length, proposedLines.length);
  const diffLines = [];
  
  for (let i = 0; i < maxLength; i++) {
    const orig = originalLines[i];
    const prop = proposedLines[i];
    
    if (orig === prop) {
      if (orig !== undefined) diffLines.push({ type: 'unchanged', text: orig });
    } else {
      if (orig !== undefined) diffLines.push({ type: 'removed', text: orig });
      if (prop !== undefined) diffLines.push({ type: 'added', text: prop });
    }
  }

  return (
    <div className="flex flex-col h-full bg-slate-950 rounded-2xl border border-indigo-500/20 overflow-hidden shadow-2xl">
      <div className="flex items-center justify-between px-4 py-3 bg-black/40 border-b border-indigo-500/20">
        <div className="flex items-center gap-2 text-indigo-400">
          <GitMerge size={16} />
          <h3 className="text-xs font-semibold uppercase tracking-widest">Autonomic Nervous System: Hot-Swap</h3>
          <span className="ml-4 px-2 py-0.5 rounded text-[10px] font-mono bg-indigo-500/10 border border-indigo-500/30">
            {fileName}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={onReject}
            className="px-3 py-1.5 rounded-lg flex items-center gap-2 text-xs font-bold transition-all bg-slate-800 text-rose-400 hover:bg-slate-700"
          >
            <XCircle size={12} /> Reject
          </button>
          <button 
            onClick={onApprove}
            className="px-3 py-1.5 rounded-lg flex items-center gap-2 text-xs font-bold transition-all bg-indigo-500 text-white hover:bg-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.3)] hover:shadow-[0_0_20px_rgba(99,102,241,0.5)]"
          >
            <CheckCircle size={12} /> Approve Synthesis
          </button>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 font-mono text-xs">
        <div className="rounded-lg border border-slate-800 overflow-hidden bg-black/60">
          {diffLines.map((line, i) => (
            <div 
              key={i} 
              className={`flex whitespace-pre-wrap ${
                line.type === 'added' ? 'bg-emerald-500/10 text-emerald-300' :
                line.type === 'removed' ? 'bg-rose-500/10 text-rose-300' :
                'text-slate-400'
              }`}
            >
              <div className={`w-8 flex-shrink-0 text-right pr-2 select-none border-r ${
                line.type === 'added' ? 'border-emerald-500/20 text-emerald-500/50' :
                line.type === 'removed' ? 'border-rose-500/20 text-rose-500/50' :
                'border-slate-800 text-slate-600'
              }`}>
                {line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '}
              </div>
              <div className="pl-4 py-0.5">{line.text}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
