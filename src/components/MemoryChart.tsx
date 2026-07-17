import React from 'react';
import { Activity } from 'lucide-react';
import { BarChart, Bar, Tooltip, ResponsiveContainer } from 'recharts';
import { startOfDay, subDays, format, isSameDay } from 'date-fns';
import { Memory } from '../App.js';

export const MemoryChart: React.FC<{ memories: Memory[] }> = ({ memories }) => {
  const chartData = React.useMemo(() => {
    const data = [];
    const today = startOfDay(new Date());
    for (let i = 29; i >= 0; i--) {
      const date = subDays(today, i);
      const count = memories.filter(m => isSameDay(new Date(m.timestamp), date)).length;
      data.push({
        date: format(date, 'MMM dd'),
        count,
      });
    }
    return data;
  }, [memories]);

  return (
    <div className="h-32 w-full mb-4 bg-black/20 rounded-lg p-2 border border-white/5 flex flex-col">
      <div className="text-[10px] text-slate-500 font-mono mb-2 flex items-center gap-1 uppercase tracking-wider shrink-0">
        <Activity className="w-3 h-3" /> Memory Formation (30d)
      </div>
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData}>
            <Tooltip 
              cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }}
              contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', border: '1px solid rgba(255,255,255,0.1)', fontSize: '12px' }}
              itemStyle={{ color: '#2dd4bf' }}
              labelStyle={{ color: '#94a3b8' }}
            />
            <Bar dataKey="count" fill="#2dd4bf" radius={[2, 2, 0, 0]} fillOpacity={0.6} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
