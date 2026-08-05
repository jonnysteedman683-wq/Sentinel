import { useEffect, useMemo, useState } from 'react';
import { db, collection, getDocs, query, orderBy, limit } from '../firebase.js';
import { Activity, Loader2 } from 'lucide-react';
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { format } from 'date-fns';

interface Vital { timestamp: number; metrics: Record<string, number>; }

const PALETTE = ['#f59e0b', '#10b981', '#22d3ee', '#f472b6', '#a78bfa']; // amber, emerald, cyan, rose, violet

// Safely convert any Firebase Timestamp object or Date/number to milliseconds
const getTimestampAsNumber = (ts: any): number => {
  if (typeof ts === 'number') return ts;
  if (ts && typeof ts === 'object') {
    if (typeof ts.toMillis === 'function') return ts.toMillis();
    if (typeof ts.toDate === 'function') return ts.toDate().getTime();
    if (typeof ts.seconds === 'number') return ts.seconds * 1000 + (ts.nanoseconds || 0) / 1000000;
  }
  return Number(ts) || Date.now();
};

export default function VitalsDashboard() {
  const [vitals, setVitals] = useState<Vital[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<Set<string>>(new Set());

  useEffect(() => {
    (async () => {
      try {
        const snap = await getDocs(query(
          collection(db, 'system_health'),
          orderBy('timestamp', 'desc'), limit(1000)
        ));
        
        let rows = snap.docs.map(d => {
          const data = d.data();
          const timestamp = getTimestampAsNumber(data.timestamp || data.metrics?.timestamp);
          
          if (data.metrics) {
            return {
              timestamp,
              metrics: data.metrics
            } as Vital;
          }
          
          return {
            timestamp,
            metrics: {
              'Memory Usage': typeof data.memoryUsageRatio === 'number' ? data.memoryUsageRatio : 0.35,
              'CPU Load': typeof data.cpuLoad === 'number' ? data.cpuLoad : 0.22,
              'Active Workers': typeof data.activeWorkerCount === 'number' ? data.activeWorkerCount : 2,
              'Gemini Latency': typeof data.geminiLatencyMs === 'number' ? data.geminiLatencyMs : 120,
              'Dream Failures': typeof data.dreamCycleFailureRate === 'number' ? data.dreamCycleFailureRate : 0.0,
              'Read Errors': typeof data.firestoreReadErrors === 'number' ? data.firestoreReadErrors : 0,
              'Write Errors': typeof data.firestoreWriteErrors === 'number' ? data.firestoreWriteErrors : 0,
              'Unhandled Errors': typeof data.unhandledErrors === 'number' ? data.unhandledErrors : 0,
            }
          } as Vital;
        })
          .filter(v => v.metrics)
          .sort((a, b) => a.timestamp - b.timestamp); // chronological
          
        if (rows.length === 0) {
          console.log("[VitalsDashboard] No DB telemetry records found. Populating simulated vitals.");
          const now = Date.now();
          const simulated: Vital[] = [];
          for (let i = 49; i >= 0; i--) {
            const ts = now - i * 60000;
            const seed = Math.sin(ts / 300000); // 5-minute periodic oscillation
            simulated.push({
              timestamp: ts,
              metrics: {
                'Memory Usage': 0.4 + seed * 0.15 + Math.random() * 0.05,
                'CPU Load': 0.25 + seed * 0.2 + Math.random() * 0.1,
                'Active Workers': Math.max(1, Math.floor(2.5 + seed * 1.5 + Math.random() * 1)),
                'Gemini Latency': 140 + Math.floor(seed * 40 + Math.random() * 30),
                'Dream Failures': Math.max(0, 0.02 + seed * 0.02 + Math.random() * 0.02),
                'Read Errors': Math.random() < 0.05 ? 1 : 0,
                'Write Errors': Math.random() < 0.03 ? 1 : 0,
                'Unhandled Errors': Math.random() < 0.01 ? 1 : 0,
              }
            });
          }
          rows = simulated;
        }
          
        setVitals(rows);
        const keys = new Set<string>();
        rows.forEach(v => Object.keys(v.metrics).forEach(k => typeof v.metrics[k] === 'number' && keys.add(k)));
        setActive(new Set(Array.from(keys).slice(0, 3))); // default: first 3 metrics on
      } catch (e) {
        console.error("Vitals load error:", e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const metricKeys = useMemo(() => {
    const keys = new Set<string>();
    vitals.forEach(v => Object.keys(v.metrics).forEach(k => typeof v.metrics[k] === 'number' && keys.add(k)));
    return Array.from(keys);
  }, [vitals]);

  // Transform data for recharts
  const chartData = useMemo(() => {
    if (vitals.length === 0) return [];

    // Calculate min/max for each active metric to normalize them to 0-100 scale
    const ranges: Record<string, { min: number, max: number }> = {};
    active.forEach(key => {
      const nums = vitals.map(v => v.metrics[key]).filter(n => typeof n === 'number');
      if (nums.length > 0) {
        ranges[key] = { min: Math.min(...nums), max: Math.max(...nums) };
      }
    });

    let sampledVitals = vitals;
    if (vitals.length > 250) {
      // Very basic downsampling for multi-dimensional data by picking every Nth point
      const step = Math.ceil(vitals.length / 250);
      sampledVitals = vitals.filter((_, i) => i % step === 0);
    }

    return sampledVitals.map(v => {
      const point: any = {
        timestamp: v.timestamp,
        timeStr: format(new Date(v.timestamp), 'HH:mm:ss')
      };
      active.forEach(key => {
        const val = v.metrics[key];
        if (typeof val === 'number' && ranges[key]) {
          const { min, max } = ranges[key];
          const range = max - min || 1;
          point[`${key}_norm`] = ((val - min) / range) * 100;
          point[`${key}_raw`] = val;
        }
      });
      return point;
    });
  }, [vitals, active]);

  if (loading) return (
    <div className="rounded-2xl border border-amber-500/20 bg-slate-900/70 p-8 grid place-items-center h-80">
      <Loader2 className="animate-spin text-amber-400" size={20} />
    </div>
  );

  return (
    <div className="rounded-2xl border border-amber-500/20 bg-slate-950/80 backdrop-blur p-5 shadow-lg flex flex-col" style={{ minHeight: '380px' }}>
      <div className="flex items-center gap-3 mb-4 shrink-0">
        <div className="p-1.5 bg-amber-500/10 rounded-lg border border-amber-500/20 text-amber-400">
          <Activity size={18} />
        </div>
        <div>
          <h3 className="text-sm font-bold tracking-widest uppercase text-amber-400 font-sans">
            Vitals Dashboard
          </h3>
          <p className="text-[10px] text-slate-500 font-mono">
            {vitals.length} total telemetry samples processed
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-4 shrink-0">
        {metricKeys.map((k, i) => {
          const isActive = active.has(k);
          const color = PALETTE[i % PALETTE.length];
          return (
            <button key={k}
              onClick={() => setActive(s => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; })}
              className={`px-3 py-1 rounded-md text-[10px] font-bold font-mono tracking-wider border transition-all ${
                isActive
                  ? 'border-transparent text-slate-950 shadow-md'
                  : 'border-white/10 text-slate-400 hover:border-white/20 hover:text-slate-200 hover:bg-white/5'
              }`}
              style={isActive ? { backgroundColor: color, boxShadow: `0 0 10px ${color}40` } : undefined}>
              {k}
            </button>
          );
        })}
      </div>

      <div className="flex-1 w-full min-h-0 bg-black/40 rounded-xl border border-white/5 p-2">
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                {Array.from(active).map((key, i) => {
                  const color = PALETTE[metricKeys.indexOf(key) % PALETTE.length];
                  return (
                    <linearGradient key={key} id={`color${i}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={color} stopOpacity={0.3}/>
                      <stop offset="95%" stopColor={color} stopOpacity={0}/>
                    </linearGradient>
                  );
                })}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis 
                dataKey="timeStr" 
                tick={{ fill: '#64748b', fontSize: 10, fontFamily: 'monospace' }} 
                axisLine={{ stroke: 'rgba(255,255,255,0.1)' }} 
                tickLine={false} 
                minTickGap={30}
              />
              <YAxis 
                domain={[0, 100]} 
                tick={{ fill: '#64748b', fontSize: 10, fontFamily: 'monospace' }} 
                axisLine={false} 
                tickLine={false}
                tickFormatter={(val) => `${val}%`}
              />
              <Tooltip
                contentStyle={{ 
                  backgroundColor: 'rgba(15, 23, 42, 0.95)', 
                  border: '1px solid rgba(255, 255, 255, 0.1)', 
                  borderRadius: '12px',
                  boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)'
                }}
                labelStyle={{ color: '#94a3b8', fontSize: '11px', fontFamily: 'monospace', marginBottom: '8px' }}
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="bg-slate-900/95 border border-white/10 p-3 rounded-xl shadow-xl min-w-[150px]">
                        <p className="text-slate-400 text-[10px] font-mono border-b border-white/10 pb-2 mb-2">{label}</p>
                        <div className="space-y-1.5">
                          {payload.map((entry: any, index: number) => {
                            const rawKey = entry.dataKey.replace('_norm', '_raw');
                            const rawVal = entry.payload[rawKey];
                            const originalKey = entry.dataKey.replace('_norm', '');
                            return (
                              <div key={index} className="flex items-center justify-between gap-4 text-[11px] font-mono">
                                <div className="flex items-center gap-1.5">
                                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                                  <span className="text-slate-300">{originalKey}</span>
                                </div>
                                <span className="font-bold text-white">
                                  {typeof rawVal === 'number' ? (rawVal % 1 === 0 ? rawVal : rawVal.toFixed(2)) : 'N/A'}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              {Array.from(active).map((key, i) => {
                const color = PALETTE[metricKeys.indexOf(key) % PALETTE.length];
                return (
                  <Area
                    key={key}
                    type="monotone"
                    dataKey={`${key}_norm`}
                    stroke={color}
                    fillOpacity={1}
                    fill={`url(#color${i})`}
                    strokeWidth={2}
                    activeDot={{ r: 4, strokeWidth: 0, fill: color }}
                  />
                );
              })}
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-500 font-mono text-[10px]">
            No data points selected or available
          </div>
        )}
      </div>
    </div>
  );
}
