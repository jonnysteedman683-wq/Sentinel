import { useEffect, useState } from 'react';

interface InsightData {
  insight: string;
  sources: string[];
  confidence: number;
}

interface Props {
  insight: InsightData | null;
  onSave: (insight: InsightData) => void;
  onDismiss: () => void;
  onTimeout: () => void;
}

export default function InsightReveal({ insight, onSave, onDismiss, onTimeout }: Props) {
  const [visible, setVisible] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    if (!insight) return;
    setVisible(true);
    const timer = setTimeout(() => {
      setVisible(false);
      onTimeout();
    }, 60000); // 60 seconds
    return () => clearTimeout(timer);
  }, [insight]);

  if (!visible || !insight) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="relative w-full max-w-lg bg-gradient-to-br from-gray-900 via-slate-900 to-black border border-transparent rounded-2xl shadow-2xl overflow-hidden">
        {/* Animated gradient border */}
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-yellow-400 via-amber-500 to-orange-500 opacity-20 animate-gradient-x pointer-events-none" />
        <div className="relative p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-amber-300 flex items-center gap-2">
              <span className="text-2xl">💡</span> Insight
            </h3>
            <button onClick={() => { setVisible(false); onDismiss(); }} className="text-gray-400 hover:text-white text-xl">✕</button>
          </div>
          <p className="text-gray-100 text-base leading-relaxed">{insight.insight}</p>
          <div className="flex items-center gap-4 text-xs text-gray-400">
            <span>Confidence: {(insight.confidence * 100).toFixed(0)}%</span>
            {insight.sources.length > 0 && (
              <button onClick={() => setShowDetails(!showDetails)} className="underline hover:text-amber-300">
                {showDetails ? 'Hide sources' : 'Show sources'}
              </button>
            )}
          </div>
          {showDetails && (
            <div className="text-xs text-gray-500 bg-black/30 rounded-lg p-2">
              Sources: {insight.sources.join(', ')}
            </div>
          )}
          <div className="flex gap-3 pt-2">
            <button
              onClick={() => { setVisible(false); onSave(insight); }}
              className="px-5 py-2 text-sm bg-amber-600 hover:bg-amber-500 rounded-lg transition font-medium"
            >
              Save Insight
            </button>
            <button
              onClick={() => { setVisible(false); onDismiss(); }}
              className="px-5 py-2 text-sm bg-gray-700 hover:bg-gray-600 rounded-lg transition"
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
