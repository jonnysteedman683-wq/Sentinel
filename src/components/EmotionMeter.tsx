import { useState } from 'react';

interface EmotionMeterProps {
  onSave: (vad: { valence: number, arousal: number, dominance: number }) => void;
}

export function EmotionMeter({ onSave }: EmotionMeterProps) {
  const [vad, setVad] = useState({ valence: 0, arousal: 0, dominance: 0 });

  return (
    <div className="bg-gray-800 p-4 rounded space-y-4 text-white">
      <h3 className="text-lg font-bold">How are you feeling?</h3>
      {['valence', 'arousal', 'dominance'].map(dim => (
        <div key={dim} className="space-y-1">
          <div className="flex justify-between text-xs">
            <span>{dim}</span>
            <span>{vad[dim as keyof typeof vad].toFixed(2)}</span>
          </div>
          <input
            type="range"
            min="-1"
            max="1"
            step="0.05"
            value={vad[dim as keyof typeof vad]}
            onChange={e => setVad({ ...vad, [dim]: parseFloat(e.target.value) })}
            className="w-full"
          />
        </div>
      ))}
      <button onClick={() => onSave(vad)} className="bg-purple-600 w-full p-2 rounded">Save Snapshot</button>
    </div>
  );
}
