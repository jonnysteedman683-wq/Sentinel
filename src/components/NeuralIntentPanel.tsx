import React from 'react';
import { Zap } from 'lucide-react';

interface Prediction {
  action: string;
  probability: number;
}

interface NeuralIntentPanelProps {
  predictions: Prediction[];
}

export const NeuralIntentPanel: React.FC<NeuralIntentPanelProps> = ({ predictions }) => {
  return (
    <div className="bg-black/40 border border-white/5 p-4 rounded-2xl">
      <h3 className="text-teal-400 text-[10px] font-bold uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
        <Zap className="w-3.5 h-3.5 text-yellow-400 animate-pulse" /> Neural Intent Engine (ML-Inference)
      </h3>
      <p className="text-[11px] text-slate-400 mb-4 leading-relaxed font-sans">
        A k-Nearest Neighbors classifier trains locally in a Web Worker (WebGPU accelerated) from your interaction telemetry, predicting your next likely action based on time of day, active tab, conversation activity, and screen scale.
      </p>
      
      {predictions && predictions.length > 0 ? (
        <div className="space-y-3">
          {predictions.slice(0, 4).map((p, i) => (
            <div key={i} className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-mono text-slate-300 font-medium capitalize">{p.action.replace(/_/g, ' ').replace('click ', 'goto ')}</span>
                <span className="font-mono text-teal-400 font-bold bg-teal-400/10 px-1.5 py-0.5 rounded text-[10px]">{(p.probability * 100).toFixed(0)}% Match</span>
              </div>
              <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-teal-500 to-indigo-500 rounded-full transition-all duration-500" 
                  style={{ width: `${p.probability * 100}%` }} 
                />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-4 text-slate-500 border border-dashed border-white/5 rounded-xl">
          <p className="text-xs italic mb-2 font-sans">Awaiting telemetry logs...</p>
        </div>
      )}
    </div>
  );
};
