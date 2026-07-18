import React from 'react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { Identity } from '../types.js';

interface IdentityHistoryItem extends Identity {
  timestamp: number;
}

interface IdentityDriftChartProps {
  history: IdentityHistoryItem[];
  theme: 'dark' | 'light';
}

export const IdentityDriftChart: React.FC<IdentityDriftChartProps> = ({ history, theme }) => {
  if (!history || history.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-xs font-mono text-slate-500 uppercase tracking-widest">No identity history available</p>
      </div>
    );
  }

  // Find all unique traits across all history versions
  const allTraits = new Set<string>();
  history.forEach(h => {
    if (h.personalityTraits) {
      Object.keys(h.personalityTraits).forEach(t => allTraits.add(t));
    }
  });

  const oldest = history[history.length - 1]; // Assuming sorted newest to oldest
  const newest = history[0];

  const data = Array.from(allTraits).map(trait => {
    return {
      subject: trait,
      current: newest?.personalityTraits?.[trait] || 0,
      baseline: oldest?.personalityTraits?.[trait] || 0,
    };
  });

  const isDark = theme === 'dark';

  return (
    <ResponsiveContainer width="100%" height={300}>
      <RadarChart cx="50%" cy="50%" outerRadius="80%" data={data}>
        <PolarGrid stroke={isDark ? '#334155' : '#e2e8f0'} />
        <PolarAngleAxis dataKey="subject" tick={{ fill: isDark ? '#94a3b8' : '#64748b', fontSize: 10, fontFamily: 'monospace', textTransform: 'uppercase' } as any} />
        <PolarRadiusAxis angle={30} domain={[0, 1]} tick={false} axisLine={false} />
        <Tooltip 
          contentStyle={{ backgroundColor: isDark ? '#0f172a' : '#ffffff', borderColor: isDark ? '#334155' : '#e2e8f0', borderRadius: '8px' }}
          itemStyle={{ fontSize: 10, fontFamily: 'monospace' }}
        />
        <Legend wrapperStyle={{ fontSize: 10, fontFamily: 'monospace' }} />
        <Radar name="Baseline (Origin)" dataKey="baseline" stroke="#64748b" fill="#64748b" fillOpacity={0.2} />
        <Radar name="Current Identity" dataKey="current" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.5} />
      </RadarChart>
    </ResponsiveContainer>
  );
};
