import { useEffect, useState } from 'react';
import { db, collection, onSnapshot } from '../firebase.js';
import { useAuth } from '../hooks/useAuth.js';
import { SynapticPayload, CRDTSynapse } from '../lib/crdt-synapse.js';
import { Network, Activity, Globe, Database } from 'lucide-react';

export function FederationDashboard() {
  const { user } = useAuth();
  const [synapses, setSynapses] = useState<SynapticPayload[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    
    // Subscribe to federated synapses
    const unsub = onSnapshot(collection(db, `users/${user.uid}/federatedSynapses`), (snap: any) => {
      const data = snap.docs.map((d: any) => d.data() as SynapticPayload);
      setSynapses(data);
      setLoading(false);
    });
      
    return () => unsub();
  }, [user]);

  // Use CRDT helper to resolve weights
  const helper = new CRDTSynapse('local-viewer', synapses);

  return (
    <div className="bg-slate-900 border border-slate-700/50 rounded-xl overflow-hidden p-4 space-y-4">
      <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
        <Globe className="text-teal-400" size={20} />
        <h3 className="text-sm font-semibold tracking-wide text-slate-200">Global Federation Sync</h3>
        <span className="text-xs bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full ml-auto">
          {synapses.length} Edges
        </span>
      </div>

      <div className="max-h-64 overflow-y-auto custom-scrollbar">
        {loading ? (
          <div className="flex items-center justify-center p-6 space-x-2 text-slate-500">
            <Activity className="animate-pulse" size={16} />
            <span className="text-xs">Synchronizing CRDT mesh...</span>
          </div>
        ) : synapses.length === 0 ? (
          <div className="text-center p-6 text-slate-500 text-xs">
            No federated synapses detected.
          </div>
        ) : (
          <div className="space-y-2">
            {synapses.map(syn => {
              const weight = helper.getWeight(syn.source, syn.target);
              const totalAdds = Object.keys(syn.weightAdds).length;
              return (
                <div key={helper.edgeId(syn.source, syn.target)} className="bg-slate-800/50 p-2.5 rounded-lg flex items-center justify-between group hover:bg-slate-800 transition-colors">
                  <div className="flex items-center gap-2">
                    <Network size={14} className="text-teal-500/70" />
                    <div className="text-xs font-mono text-slate-300">
                      <span className="truncate max-w-[80px] inline-block" title={syn.source}>{syn.source.substring(0, 8)}</span>
                      <span className="text-slate-500 mx-1">↔</span>
                      <span className="truncate max-w-[80px] inline-block" title={syn.target}>{syn.target.substring(0, 8)}</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3 text-right">
                    <div className="flex items-center gap-1.5" title={`${totalAdds} nodes contributed`}>
                      <Database size={12} className="text-slate-500" />
                      <span className="text-[10px] text-slate-400">{totalAdds}</span>
                    </div>
                    <div className="bg-slate-900/50 border border-slate-700 px-2 py-1 rounded text-teal-400 font-mono text-xs w-16 text-center">
                      {weight.toFixed(3)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
