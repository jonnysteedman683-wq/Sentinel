import { useEffect, useState } from 'react';
import { getFirestore, collection, query, onSnapshot, orderBy } from '../firebase.js';
import { useAuth } from '../hooks/useAuth.js';
import { MemoryNode, WisdomNode } from '../types.js';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { fetchWithTracing } from '../lib/fetchWithTracing.js';

export function MemoriaDashboard() {
  const { user } = useAuth();
  const [memories, setMemories] = useState<MemoryNode[]>([]);
  const [wisdomNodes, setWisdomNodes] = useState<WisdomNode[]>([]);
  const [metrics, setMetrics] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    const db = getFirestore();
    const memQuery = query(collection(db, `users/${user.uid}/memories`), orderBy('lastAccessed', 'desc'));
    const unsubMem = onSnapshot(memQuery, snap => {
      setMemories(snap.docs.map((d: any) => ({ id: d.id, ...d.data() } as MemoryNode)));
    });

    const wisdomQuery = query(collection(db, `users/${user.uid}/wisdom`), orderBy('createdAt', 'desc'));
    const unsubWis = onSnapshot(wisdomQuery, snap => {
      setWisdomNodes(snap.docs.map((d: any) => ({ id: d.id, ...d.data() } as WisdomNode)));
    });

    return () => { unsubMem(); unsubWis(); };
  }, [user]);

  // Compute metrics for chart
  useEffect(() => {
    const stateCounts: Record<string, number> = {};
    for (const mem of memories) {
      stateCounts[mem.state] = (stateCounts[mem.state] || 0) + 1;
    }
    setMetrics([
      { name: 'Ephemeral', count: stateCounts['ephemeral'] || 0 },
      { name: 'Short‑Term', count: stateCounts['shortTerm'] || 0 },
      { name: 'Long‑Term', count: stateCounts['longTerm'] || 0 },
      { name: 'Core', count: stateCounts['core'] || 0 },
      { name: 'Wisdom', count: wisdomNodes.length },
      { name: 'Forgotten', count: stateCounts['forgotten'] || 0 },
    ]);
  }, [memories, wisdomNodes]);

  const handleReinforce = async (memoryId: string) => {
    await fetchWithTracing('/api/memories/reinforce', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user?.uid, memoryId }),
    });
  };

  const handleForget = async (memoryId: string) => {
    await fetchWithTracing('/api/memories/forget', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user?.uid, memoryId }),
    });
  };

  return (
    <div className="p-4 space-y-8">
      <h2 className="text-2xl font-bold text-purple-400">Memoria – Eternal Learning</h2>

      {/* Memory State Bar Chart */}
      <section className="bg-gray-900 p-4 rounded">
        <h3 className="text-lg mb-2">Memory Distribution</h3>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={metrics}>
            <CartesianGrid strokeDasharray="3 3" stroke="#444" />
            <XAxis dataKey="name" stroke="#aaa" />
            <YAxis stroke="#aaa" />
            <Tooltip />
            <Legend />
            <Bar dataKey="count" fill="#8b5cf6" />
          </BarChart>
        </ResponsiveContainer>
      </section>

      {/* Wisdom Timeline */}
      <section className="bg-gray-900 p-4 rounded">
        <h3 className="text-lg mb-2">Wisdom Timeline</h3>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {wisdomNodes.map(w => (
            <div key={w.id} className="p-2 bg-gray-800 rounded">
              <p className="text-sm text-purple-300">{w.insight}</p>
              <p className="text-xs text-gray-400">{new Date(w.createdAt?.toDate()).toLocaleDateString()}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Memory Garden (simplified list) */}
      <section className="bg-gray-900 p-4 rounded">
        <h3 className="text-lg mb-2">Memory Garden</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-96 overflow-y-auto">
          {memories.filter(m => m.state !== 'forgotten').map(m => (
            <div key={m.id} className="bg-gray-800 p-2 rounded flex justify-between items-center">
              <div>
                <p className="text-sm truncate max-w-[200px]">{m.content.slice(0, 50)}</p>
                <p className="text-xs text-gray-400">
                  {m.state} | strength: {m.strength.toFixed(2)} | accessed: {new Date(m.lastAccessed?.toDate()).toLocaleDateString()}
                </p>
              </div>
              <div className="flex gap-1">
                <button onClick={() => handleReinforce(m.id)} className="text-xs bg-green-700 px-2 py-1 rounded">+</button>
                <button onClick={() => handleForget(m.id)} className="text-xs bg-red-700 px-2 py-1 rounded">−</button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
