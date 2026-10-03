import { useEffect, useState } from 'react';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, db, auth } from '../firebase.js';
import { ThumbsUp, ThumbsDown } from 'lucide-react';

interface SavedInsight {
  id: string;
  text: string;
  memoryCount?: number;
  createdAt?: any;
  successScore?: number;
}

export default function InsightFeed({ onReward }: { onReward?: (reward: number) => void }) {
  const [insights, setInsights] = useState<SavedInsight[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!auth.currentUser) return;
    const uid = auth.currentUser.uid;
    const q = query(
      collection(db, `users/${uid}/insights`),
      orderBy('createdAt', 'desc')
    );
    const unsub = onSnapshot(q, snapshot => {
      setInsights(snapshot.docs.map((d: any) => ({ id: d.id, ...d.data() } as SavedInsight)));
    });
    return unsub;
  }, []);

  const handleRate = async (id: string, score: number) => {
    if (!auth.currentUser) return;
    const uid = auth.currentUser.uid;
    await updateDoc(doc(db, `users/${uid}/insights`, id), {
      successScore: score
    });
    if (onReward) {
      onReward(score);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed left-0 top-1/3 bg-amber-900/70 text-amber-200 px-2 py-4 rounded-r-lg text-sm hover:bg-amber-800 transition z-40"
        title="Weekly Insights"
      >
        💡
      </button>
    );
  }

  return (
    <div className="fixed left-0 top-0 h-full w-80 bg-gray-900/95 backdrop-blur border-r border-gray-700 p-4 z-40 overflow-y-auto flex flex-col">
      <div className="flex justify-between items-center mb-4 pb-2 border-b border-gray-700">
        <h2 className="text-lg font-semibold text-amber-300">Weekly Insights</h2>
        <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-white">✕</button>
      </div>
      
      <div className="flex-1 overflow-y-auto pr-1">
        {insights.length === 0 && <p className="text-gray-500 text-sm italic">No insights synthesized yet.</p>}
        {insights.map(ins => (
          <div key={ins.id} className="mb-4 p-3 bg-slate-800/80 border border-amber-500/20 rounded-lg text-sm flex flex-col relative group">
            <p className="text-gray-200 mb-2 leading-relaxed">{ins.text}</p>
            <div className="flex items-center justify-between mt-1 pt-2 border-t border-slate-700/50">
              <span className="text-[10px] font-mono text-slate-500">
                {ins.memoryCount ? `${ins.memoryCount} nodes` : 'Synthesized'}
              </span>
              <div className="flex items-center gap-1">
                <button 
                  onClick={() => handleRate(ins.id, 1.0)}
                  disabled={ins.successScore !== undefined}
                  className={`p-1.5 rounded-md transition-colors ${ins.successScore === 1 ? 'text-amber-400 bg-amber-400/10' : 'text-slate-500 hover:text-amber-400 hover:bg-slate-700 disabled:opacity-50'}`}
                >
                  <ThumbsUp size={12} />
                </button>
                <button 
                  onClick={() => handleRate(ins.id, -0.5)}
                  disabled={ins.successScore !== undefined}
                  className={`p-1.5 rounded-md transition-colors ${ins.successScore === -0.5 ? 'text-red-400 bg-red-400/10' : 'text-slate-500 hover:text-red-400 hover:bg-slate-700 disabled:opacity-50'}`}
                >
                  <ThumbsDown size={12} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
