import React, { useEffect, useState } from 'react';
import { Cpu, Award, Zap, Loader2, BarChart2 } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { auth } from '../firebase.js';

export function SkillEvolutionGraph() {
  const [data, setData] = useState<{ skills: any[], concepts: any[] } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSkills = async () => {
      try {
        const token = auth.currentUser ? await auth.currentUser.getIdToken() : '';
        const res = await fetch('/api/skills/summary', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const json = await res.json();
          setData(json);
        }
      } catch (e) {
        console.error("Failed to load skills", e);
      } finally {
        setLoading(false);
      }
    };
    fetchSkills();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 gap-2 text-slate-500">
        <Loader2 className="w-6 h-6 animate-spin text-teal-400" />
        <span className="text-xs font-mono">Loading Skill Matrices...</span>
      </div>
    );
  }

  const { skills = [], concepts = [] } = data || {};

  const chartData = skills.map((s, idx) => ({
    name: s.name.substring(0, 8),
    successRate: s.successRate * 100,
    useCount: s.useCount,
  }));

  return (
    <div className="space-y-6">
      {/* Skill evolution chart */}
      {chartData.length > 0 && (
        <div className="bg-black/30 border border-white/5 rounded-xl p-4">
          <div className="text-[10px] text-slate-500 font-mono mb-4 flex items-center gap-1 uppercase tracking-wider">
            <BarChart2 className="w-3.5 h-3.5 text-teal-400" /> Skill Competence & Usage Matrix
          </div>
          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="name" stroke="#64748b" fontSize={10} />
                <YAxis stroke="#64748b" fontSize={10} />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', border: '1px solid rgba(255,255,255,0.1)', fontSize: '11px' }}
                />
                <Line type="monotone" dataKey="successRate" stroke="#2dd4bf" strokeWidth={2} name="Success Rate (%)" />
                <Line type="monotone" dataKey="useCount" stroke="#a855f7" strokeWidth={2} name="Use Count" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Skills Cards Grid */}
        <div className="space-y-4">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
            <Award className="w-4 h-4 text-teal-400" /> Active System Skills
          </h3>
          <div className="space-y-3">
            {skills.map(s => (
              <div key={s.id} className="bg-white/5 border border-white/10 p-3 rounded-lg flex flex-col gap-1.5">
                <div className="flex justify-between items-start">
                  <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Cpu className="w-3.5 h-3.5 text-teal-400" /> {s.name}
                  </h4>
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                    s.successRate >= 0.9 ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400' : 'bg-amber-500/10 border-amber-500/25 text-amber-400'
                  }`}>
                    {(s.successRate * 100).toFixed(0)}% SR
                  </span>
                </div>
                <p className="text-xs text-slate-400">{s.description}</p>
                <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-1 border-t border-white/5 pt-1.5">
                  <span>Uses: {s.useCount}</span>
                  <span>Last: {new Date(s.lastUsed).toLocaleTimeString()}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Semantic Concept list */}
        <div className="space-y-4">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
            <Zap className="w-4 h-4 text-purple-400" /> Semantic Concepts
          </h3>
          <div className="space-y-3">
            {concepts.map(c => (
              <div key={c.id} className="bg-white/5 border border-white/10 p-3 rounded-lg flex flex-col gap-1.5">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-purple-300">#{c.concept}</span>
                  <span className="text-[10px] text-slate-500 font-mono">Strength: {c.strength}%</span>
                </div>
                <p className="text-xs text-slate-400 italic leading-relaxed">"{c.definition.substring(0, 90)}{c.definition.length > 90 ? '...' : ''}"</p>
                {c.associations && c.associations.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {c.associations.map((tag: string) => (
                      <span key={tag} className="text-[9px] font-medium bg-purple-500/10 text-purple-300 border border-purple-500/20 px-1.5 py-0.5 rounded">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {concepts.length === 0 && (
              <div className="text-slate-500 text-xs italic py-4">No semantic concepts consolidated yet.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
