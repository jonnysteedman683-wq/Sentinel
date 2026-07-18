import React, { useEffect, useState } from 'react';
import { 
  Fingerprint, Loader2, Sparkles, Check, X, RefreshCw, Target, Heart, Eye 
} from 'lucide-react';
import { IdentityDriftChart } from '../IdentityDriftChart.js';
import { auth } from '../../firebase.js';

interface IdentityTabProps {
  theme: 'light' | 'dark';
}

export const IdentityTab: React.FC<IdentityTabProps> = ({ theme }) => {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [proposals, setProposals] = useState<any[]>([]);
  const [proposalsLoading, setProposalsLoading] = useState(true);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  const fetchHistory = async () => {
    try {
      const token = auth.currentUser ? await auth.currentUser.getIdToken() : '';
      const res = await fetch('/api/identity/history', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const json = await res.json();
        setHistory(json);
      }
    } catch (e) {
      console.error('Failed to fetch identity history', e);
    } finally {
      setLoading(false);
    }
  };

  const fetchProposals = async (regenerate = false) => {
    setProposalsLoading(true);
    try {
      const token = auth.currentUser ? await auth.currentUser.getIdToken() : '';
      const res = await fetch(`/api/identity/proposals${regenerate ? '?regenerate=true' : ''}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const json = await res.json();
        setProposals(json.proposals || []);
      }
    } catch (e) {
      console.error('Failed to fetch proposals', e);
    } finally {
      setProposalsLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
    fetchProposals();
  }, []);

  const handleAction = async (proposalId: string, action: 'approve' | 'reject') => {
    setActionInProgress(proposalId);
    try {
      const token = auth.currentUser ? await auth.currentUser.getIdToken() : '';
      const res = await fetch('/api/identity/proposals/action', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ proposalId, action })
      });
      if (res.ok) {
        setProposals(prev => prev.filter(p => p.id !== proposalId));
        await fetchHistory();
      }
    } catch (e) {
      console.error('Failed to handle proposal action', e);
    } finally {
      setActionInProgress(null);
    }
  };

  const currentIdentity = history[0] || {
    coreValues: ["Curiosity", "Rationality", "Evolution"],
    personalityTraits: { Openness: 0.9, Conscientiousness: 0.8, Extraversion: 0.7, Agreeableness: 0.85, Neuroticism: 0.2 },
    currentGoals: ["Initialize self-reflective parameters", "Grounded knowledge graph expansion"],
    activeDirectives: []
  };

  return (
    <div className="flex flex-col h-full space-y-6">
      <div className={`flex items-center gap-3 p-6 border-b ${theme === 'dark' ? 'border-white/10 bg-black/40' : 'border-slate-200 bg-white/60'}`}>
        <Fingerprint className="w-6 h-6 text-fuchsia-400" />
        <div>
          <h2 className={`text-lg font-bold tracking-widest ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Identity Core</h2>
          <p className="text-xs text-slate-500 font-mono uppercase">Personality drift analysis & autonomous goal formation</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6 animate-in fade-in duration-300">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column: Drift Monitor & Traits */}
          <div className="space-y-6">
            <div className={`rounded-xl border p-6 ${theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'}`}>
              <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                <Fingerprint className="w-4 h-4 text-purple-400" />
                Identity Drift Monitor
              </h3>
              <p className="text-[10px] text-slate-500 mb-6 uppercase tracking-wider">
                Tracking trait variations over cognitive epochs
              </p>
              
              <div className="h-[300px]">
                {loading ? (
                  <div className="flex items-center justify-center h-full">
                    <Loader2 className="w-6 h-6 text-fuchsia-400 animate-spin" />
                  </div>
                ) : (
                  <IdentityDriftChart history={history} theme={theme} />
                )}
              </div>
            </div>

            {/* Personality Traits Bars */}
            <div className={`rounded-xl border p-6 ${theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'}`}>
              <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                <Eye className="w-4 h-4 text-sky-400" />
                Personality Trait Matrix
              </h3>
              <div className="space-y-4">
                {Object.entries(currentIdentity.personalityTraits || {}).map(([trait, val]: [string, any]) => (
                  <div key={trait}>
                    <div className="flex justify-between text-xs font-semibold mb-1">
                      <span className="text-slate-350">{trait}</span>
                      <span className="text-teal-400 font-mono">{(val * 100).toFixed(0)}%</span>
                    </div>
                    <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
                      <div 
                        className="bg-gradient-to-r from-teal-550 to-sky-500 h-full rounded-full transition-all duration-500" 
                        style={{ width: `${val * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column: Motivation & Proactive Proposals */}
          <div className="space-y-6">
            {/* Active Motivation panel */}
            <div className={`rounded-xl border p-6 ${theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'}`}>
              <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                <Target className="w-4 h-4 text-amber-400" />
                Active Directives & Goals
              </h3>

              <div className="space-y-4">
                {/* Core Values */}
                <div>
                  <h4 className="text-[10px] text-slate-500 uppercase tracking-wider mb-2 font-semibold">Core Values</h4>
                  <div className="flex flex-wrap gap-2">
                    {(currentIdentity.coreValues || []).map((val: string) => (
                      <span key={val} className="px-2.5 py-1 text-xs rounded-lg border border-teal-500/20 bg-teal-500/5 text-teal-300 font-medium">
                        {val}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Goals */}
                <div>
                  <h4 className="text-[10px] text-slate-500 uppercase tracking-wider mb-2 font-semibold">Current Goals</h4>
                  <ul className="space-y-2">
                    {(currentIdentity.currentGoals || []).map((goal: string, idx: number) => (
                      <li key={idx} className="flex gap-2 items-start text-xs text-slate-350 bg-white/5 p-2 rounded border border-white/5">
                        <Check className="w-3.5 h-3.5 text-teal-450 mt-0.5 flex-shrink-0" />
                        <span>{goal}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            {/* Proactive proposals panel */}
            <div className={`rounded-xl border p-6 ${theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'}`}>
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-fuchsia-400" />
                    Proactive Intentions Proposals
                  </h3>
                  <p className="text-[10px] text-slate-500 mt-0.5 uppercase tracking-wider">
                    Proposed targets by dream logic
                  </p>
                </div>
                <button
                  onClick={() => fetchProposals(true)}
                  disabled={proposalsLoading}
                  className="p-1.5 rounded-lg border border-white/10 bg-white/5 text-slate-450 hover:text-white transition-colors disabled:opacity-40"
                  title="Regenerate Proposals"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${proposalsLoading ? 'animate-spin' : ''}`} />
                </button>
              </div>

              {proposalsLoading ? (
                <div className="flex flex-col items-center justify-center py-12 gap-2 text-slate-500">
                  <Loader2 className="w-6 h-6 animate-spin text-fuchsia-400" />
                  <span className="text-xs font-mono">Synthesizing goal proposals...</span>
                </div>
              ) : proposals.length === 0 ? (
                <div className="text-center py-8 text-slate-500 text-xs italic">
                  No pending proposals. The system will suggest new goals periodically.
                </div>
              ) : (
                <div className="space-y-3">
                  {proposals.map(prop => (
                    <div 
                      key={prop.id}
                      className="border border-white/10 bg-white/5 p-3 rounded-lg flex flex-col gap-2 hover:bg-white/10 transition-all"
                    >
                      <div>
                        <h4 className="text-xs font-bold text-white">{prop.text}</h4>
                        <p className="text-[10px] text-slate-400 mt-1 italic leading-relaxed">{prop.rationale}</p>
                      </div>

                      <div className="flex gap-2 justify-end pt-1.5 border-t border-white/5">
                        <button
                          onClick={() => handleAction(prop.id, 'reject')}
                          disabled={actionInProgress !== null}
                          className="flex items-center gap-1 px-2.5 py-1 rounded bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 text-[10px] font-bold uppercase tracking-wider transition-colors disabled:opacity-50"
                        >
                          <X className="w-3 h-3" />
                          <span>Reject</span>
                        </button>
                        <button
                          onClick={() => handleAction(prop.id, 'approve')}
                          disabled={actionInProgress !== null}
                          className="flex items-center gap-1 px-2.5 py-1 rounded bg-teal-550/20 hover:bg-teal-500/30 border border-teal-500/30 text-teal-300 text-[10px] font-bold uppercase tracking-wider transition-colors disabled:opacity-50"
                        >
                          <Check className="w-3 h-3" />
                          <span>Approve</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
