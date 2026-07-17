import React, { useEffect, useState } from 'react';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Droplets, AlertTriangle } from 'lucide-react';

interface LiquidStatePoint {
  x: number;
  y: number;
  isAnomaly: boolean;
  timestamp: number;
}

export const LiquidMonitor: React.FC<{ theme: string }> = ({ theme }) => {
  const [points, setPoints] = useState<LiquidStatePoint[]>([]);

  useEffect(() => {
    // In a real implementation, we'd fetch actual UMAP/PCA projected liquid states from the backend.
    // For this prototype, we'll simulate the evolving trajectory.
    const interval = setInterval(() => {
      setPoints(prev => {
        const last = prev[prev.length - 1] || { x: 50, y: 50 };
        const dx = (Math.random() - 0.5) * 10;
        const dy = (Math.random() - 0.5) * 10;
        
        // Simulating an anomaly periodically
        const isAnomaly = Math.random() < 0.05;
        
        let newX = Math.max(0, Math.min(100, last.x + dx));
        let newY = Math.max(0, Math.min(100, last.y + dy));
        
        if (isAnomaly) {
           newX = Math.random() * 100;
           newY = Math.random() * 100;
        }

        const newPoint = {
          x: newX,
          y: newY,
          isAnomaly,
          timestamp: Date.now()
        };

        const updated = [...prev, newPoint];
        if (updated.length > 50) return updated.slice(updated.length - 50);
        return updated;
      });
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  const normalData = points.filter(p => !p.isAnomaly);
  const anomalyData = points.filter(p => p.isAnomaly);

  return (
    <div className={`p-6 rounded-xl border ${theme === 'dark' ? 'bg-black/40 border-white/10' : 'bg-white/60 border-slate-200'} flex flex-col h-full min-h-[300px]`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold uppercase tracking-widest flex items-center gap-2 text-blue-400">
          <Droplets className="w-4 h-4" />
          Liquid State Projection
        </h3>
        <span className="text-[10px] font-mono text-slate-500 bg-slate-500/10 px-2 py-1 rounded">2D PCA/UMAP</span>
      </div>
      
      <div className="flex-1 min-h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 10, right: 10, bottom: 10, left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
            <XAxis type="number" dataKey="x" domain={[0, 100]} tick={false} axisLine={false} />
            <YAxis type="number" dataKey="y" domain={[0, 100]} tick={false} axisLine={false} />
            <Tooltip 
              contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px' }}
              labelFormatter={() => ''}
              formatter={(val: any, name: any) => [Number(val).toFixed(2), String(name)]}
            />
            
            {/* Trajectory lines could be drawn here, but recharts scatter doesn't easily connect dots dynamically without LineChart combo, 
                so we rely on scatter points */}
            <Scatter name="State" data={normalData} fill="#3b82f6" fillOpacity={0.6} shape="circle" line lineType="joint" />
            <Scatter name="Anomaly" data={anomalyData} fill="#ef4444" shape="star" />
            
          </ScatterChart>
        </ResponsiveContainer>
      </div>
      
      {anomalyData.length > 0 && (
        <div className="mt-4 flex items-center gap-2 text-xs text-red-400 bg-red-400/10 p-2 rounded-lg border border-red-400/20 animate-pulse">
          <AlertTriangle className="w-4 h-4" />
          <span>Anomaly detected in recent thought sequence! Triggering insight generation...</span>
        </div>
      )}
    </div>
  );
};
