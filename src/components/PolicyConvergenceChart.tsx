import React from 'react';
import { Zap } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export const PolicyConvergenceChart: React.FC<{ data: { episode: number; qValue: number }[] }> = ({ data }) => {
  return (
    <div className="h-48 w-full bg-black/40 rounded-2xl p-4 border border-white/5 flex flex-col relative overflow-hidden group">
      <div className="text-[10px] text-amber-500 font-bold mb-4 flex items-center gap-2 uppercase tracking-widest shrink-0">
        <Zap className="w-4 h-4" /> Policy Convergence (Q-Value Stability)
      </div>
      <div className="flex-1 min-h-0 w-full relative z-10">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="qValueGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4}/>
                <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
            <XAxis dataKey="episode" hide />
            <YAxis hide domain={[0, 1]} />
            <Tooltip 
              contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.95)', border: '1px solid rgba(255,255,255,0.1)', fontSize: '11px', borderRadius: '8px', color: '#f59e0b', fontFamily: 'monospace' }}
              itemStyle={{ color: '#f59e0b' }}
              labelStyle={{ color: '#94a3b8' }}
            />
            <Area type="monotone" dataKey="qValue" stroke="#f59e0b" strokeWidth={2} fillOpacity={1} fill="url(#qValueGrad)" activeDot={{ r: 4, fill: '#f59e0b', strokeWidth: 0 }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
