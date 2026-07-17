import React from 'react';
import { TrendingUp, Smile, Meh, Frown } from 'lucide-react';
import { ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { format } from 'date-fns';
import { Memory } from '../App.js';

interface SentimentDriftChartProps {
  memories: Memory[];
}

export const SentimentDriftChart: React.FC<SentimentDriftChartProps> = ({ memories }) => {
  const chartData = React.useMemo(() => {
    // Filter memories with valid sentiment and sort by timestamp ascending
    const sorted = [...memories]
      .filter(m => m.sentiment !== undefined)
      .sort((a, b) => a.timestamp - b.timestamp);

    if (sorted.length === 0) return [];

    let runningSum = 0;
    return sorted.map((m, idx) => {
      runningSum += m.sentiment || 0;
      const rollingAvg = runningSum / (idx + 1);
      
      return {
        timestamp: m.timestamp,
        dateStr: format(new Date(m.timestamp), 'MM-dd HH:mm'),
        sentiment: parseFloat((m.sentiment || 0).toFixed(2)),
        drift: parseFloat(rollingAvg.toFixed(2)),
        text: m.text.length > 40 ? m.text.substring(0, 37) + '...' : m.text
      };
    });
  }, [memories]);

  const latestDrift = React.useMemo(() => {
    if (chartData.length === 0) return 0;
    return chartData[chartData.length - 1].drift;
  }, [chartData]);

  if (memories.length === 0) {
    return (
      <div className="h-56 w-full bg-black/20 rounded-2xl p-4 border border-white/5 flex flex-col justify-center items-center">
        <TrendingUp className="w-8 h-8 text-slate-700 mb-2 animate-pulse" />
        <span className="text-[11px] font-mono text-slate-500 uppercase tracking-widest">No Sentiment Logs Recorded</span>
      </div>
    );
  }

  return (
    <div className="bg-slate-950/40 border border-white/10 p-5 rounded-2xl shadow-lg relative overflow-hidden flex flex-col h-72">
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-amber-500/10 rounded-lg border border-amber-500/20 text-amber-400">
            <TrendingUp className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-slate-200 text-xs font-bold uppercase tracking-widest font-sans">
              Sentiment Drift Over Time
            </h3>
            <p className="text-[9px] text-slate-500 font-mono">
              Analyzing cognitive mood patterns across {chartData.length} memory epochs
            </p>
          </div>
        </div>

        {/* Dynamic Status Pill */}
        <div className="flex items-center gap-1 bg-white/5 border border-white/10 px-2.5 py-1 rounded-lg">
          {latestDrift > 0.15 ? (
            <>
              <Smile className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-[9px] font-mono font-bold text-emerald-400 uppercase">POS-DRIFT ({latestDrift.toFixed(2)})</span>
            </>
          ) : latestDrift < -0.15 ? (
            <>
              <Frown className="w-3.5 h-3.5 text-red-400" />
              <span className="text-[9px] font-mono font-bold text-red-400 uppercase">NEG-DRIFT ({latestDrift.toFixed(2)})</span>
            </>
          ) : (
            <>
              <Meh className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-[9px] font-mono font-bold text-slate-400 uppercase">STABLE ({latestDrift.toFixed(2)})</span>
            </>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0 w-full">
        {chartData.length < 2 ? (
          <div className="h-full w-full flex flex-col justify-center items-center text-center">
            <p className="text-[10px] text-slate-500 font-mono italic">Awaiting more semantic data points to plot drift trajectories...</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 5, right: 10, left: -25, bottom: 5 }}>
              <defs><linearGradient id="driftGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4}/><stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/></linearGradient></defs><CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
              <XAxis 
                dataKey="dateStr" 
                tick={{ fill: '#475569', fontSize: 8 }}
                axisLine={{ stroke: 'rgba(255,255,255,0.05)' }}
                tickLine={false}
              />
              <YAxis 
                domain={[-1, 1]} 
                tick={{ fill: '#475569', fontSize: 8 }}
                axisLine={{ stroke: 'rgba(255,255,255,0.05)' }}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{ 
                  backgroundColor: 'rgba(10, 10, 12, 0.95)', 
                  border: '1px solid rgba(255, 255, 255, 0.1)', 
                  borderRadius: '12px',
                  fontSize: '11px',
                  fontFamily: '"JetBrains Mono", monospace',
                }}
                itemStyle={{ fontSize: '11px' }}
                labelStyle={{ color: '#94a3b8', fontWeight: 'bold' }}
              />
              <ReferenceLine y={0} stroke="rgba(255, 255, 255, 0.1)" strokeDasharray="2 2" />
              
              {/* Individual Memory Sentiment Dots/Line */}
              <Line 
                name="Instant Sentiment"
                type="monotone" 
                dataKey="sentiment" 
                stroke="rgba(34, 211, 238, 0.3)" 
                strokeWidth={1} 
                dot={{ r: 2, fill: '#06b6d4', strokeWidth: 0 }}
                activeDot={{ r: 4 }}
              />

              {/* Smoothed Cumulative Sentiment Drift Trend */}
              <Area 
                name="Sentiment Drift"
                type="monotone" 
                dataKey="drift" 
                stroke="#f59e0b" 
                strokeWidth={2.5} 
                fill="url(#driftGrad)" fillOpacity={1} dot={false}
                activeDot={{ r: 6, fill: '#f59e0b' }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};
