import { useState, useEffect } from 'react';
import { Database, Cpu, Loader2, Link2 } from 'lucide-react';
import { motion } from 'motion/react';
import { ERDEntity } from '../types.js';

export function QpuErdWidget({ text }: { text?: string }) {
  const [entities, setEntities] = useState<ERDEntity[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!text) return;
    const fetchErd = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/knowledge/erd', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text })
        });
        const data = await res.json();
        if (data.success && data.erd?.entities) {
          setEntities(data.erd.entities);
        } else {
          setError(data.error || "Failed to parse entities");
        }
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };
    fetchErd();
  }, [text]);

  if (!text) {
    return <div className="text-gray-400 text-sm">No text provided for ERD.</div>;
  }

  return (
    <div className="bg-gray-900/50 border border-indigo-500/30 rounded-lg p-4 font-mono text-sm shadow-[0_0_15px_rgba(99,102,241,0.1)]">
      <div className="flex items-center gap-2 mb-4 text-indigo-400 border-b border-indigo-500/20 pb-2">
        <Cpu className="w-5 h-5 text-fuchsia-400" />
        <h3 className="font-semibold uppercase tracking-wider text-xs">QPU Knowledge Graph Integrator</h3>
        <span className="ml-auto text-[10px] bg-indigo-500/20 px-2 py-0.5 rounded text-indigo-300 border border-indigo-500/30">MAML / RML</span>
      </div>

      <div className="text-gray-300 text-xs mb-4 p-2 bg-black/40 rounded border border-gray-800">
        <span className="text-gray-500">Source Text:</span>
        <div className="mt-1 line-clamp-3 italic text-gray-400">"{text}"</div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-indigo-300 py-4 justify-center">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Executing entity recognition & semantic normalization...</span>
        </div>
      ) : error ? (
        <div className="text-red-400 py-2">Error: {error}</div>
      ) : entities.length === 0 ? (
        <div className="text-gray-400 py-2 text-center">No entities recognized.</div>
      ) : (
        <div className="space-y-3">
          <div className="text-xs text-gray-500 mb-2 uppercase tracking-wide">Extracted Entities</div>
          {entities.map((ent, i) => (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              key={i} 
              className="bg-black/60 border border-gray-800 rounded p-3"
            >
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-2">
                  <Database className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="font-bold text-emerald-300">{ent.name}</span>
                </div>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-800 text-gray-400 border border-gray-700 uppercase tracking-widest">{ent.type}</span>
              </div>
              <div className="pl-5 space-y-1.5 text-xs">
                <div className="flex items-start gap-2 text-gray-300">
                  <span className="text-gray-500 w-16 shrink-0">Canonical:</span>
                  <span className="text-indigo-200">{ent.canonical}</span>
                </div>
                {ent.relations && ent.relations.length > 0 && (
                  <div className="flex items-start gap-2 text-gray-300">
                    <span className="text-gray-500 w-16 shrink-0">Relations:</span>
                    <div className="flex flex-wrap gap-1">
                      {ent.relations.map((rel, j) => (
                        <span key={j} className="flex items-center gap-1 bg-indigo-900/30 text-indigo-300 px-1.5 rounded border border-indigo-500/20">
                          <Link2 className="w-3 h-3" />
                          {rel}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
