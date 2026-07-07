import React, { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import type { Episode, SemanticEntry } from './types';

interface MemoryStatsProps {
  episodes: Episode[];
  semanticEntries: SemanticEntry[];
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

export function MemoryStats({ episodes, semanticEntries }: MemoryStatsProps) {
  const data = useMemo(() => {
    const tagCounts: Record<string, number> = {};

    const processTags = (tags: string[]) => {
      tags.forEach(t => {
        const tag = t.toLowerCase().trim();
        if (!tag) return;
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      });
    };

    episodes.forEach(e => processTags(e.tags));
    semanticEntries.forEach(s => processTags(s.tags));

    return Object.entries(tagCounts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [episodes, semanticEntries]);

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-slate-500 text-xs">
        NO TAG DATA FOR STATS
      </div>
    );
  }

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-900 border border-slate-700 p-2 rounded text-xs shadow-lg">
          <p className="text-slate-200 font-bold uppercase">{payload[0].name}</p>
          <p className="text-slate-400">Count: {payload[0].value}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="w-full h-64 bg-slate-900/50 border border-slate-800 rounded mb-4 overflow-hidden flex flex-col">
      <div className="text-xs text-slate-500 p-2 border-b border-slate-800">
        TAG DISTRIBUTION
      </div>
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={80}
              paddingAngle={2}
              dataKey="value"
              stroke="none"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend 
              layout="vertical" 
              verticalAlign="middle" 
              align="right"
              wrapperStyle={{ fontSize: '10px', color: '#94a3b8' }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
