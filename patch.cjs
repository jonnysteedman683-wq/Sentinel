const fs = require('fs');
let content = fs.readFileSync('src/lib/hebbian.ts', 'utf8');

content = content.replace(
`import { publishEvent } from './events.js';
import { MemoryNode } from '../types.js';
import { randomUUID } from 'crypto';

const tracer = trace.getTracer('arcane-brain');`,
`import { publishEvent } from './events.js';
import { MemoryNode } from '../types.js';
import { randomUUID } from 'crypto';
import { syncFederatedSynapses } from './crdt-federation-service.js';
import { SynapticPayload, CRDTSynapse } from './crdt-synapse.js';

const tracer = trace.getTracer('arcane-brain');`
);

content = content.replace(
`    const batch = db.batch();
    const edgesRef = db.collection(\`users/\${userId}/hebbianEdges\`);
    
    let updatedCount = 0;
    for (const [id, update] of Object.entries(edgeUpdates)) {
      const edgeRef = edgesRef.doc(id);
      const edgeSnap = await edgeRef.get();
      
      if (edgeSnap.exists) {
        const currentTrace = edgeSnap.data()?.trace || 0;
        batch.set(edgeRef, {
          trace: Math.min(1.0, currentTrace + update.increment),
          lastCoaccess: update.lastTime
        }, { merge: true });
      } else {
        batch.set(edgeRef, {
          id,
          source: update.source,
          target: update.target,
          trace: Math.min(1.0, update.increment),
          lastCoaccess: update.lastTime
        });
      }
      updatedCount++;
    }
    
    if (updatedCount > 0) {
      await batch.commit();
      await publishEvent(userId, 'hebbian', 'HEBBIAN_TRACES_UPDATED', { updatedCount });
    }
    
    span.setStatus({ code: SpanStatusCode.OK });`,
`    const payloads: SynapticPayload[] = Object.values(edgeUpdates).map(u => ({
      source: u.source,
      target: u.target,
      weightAdds: { 'server-node': u.increment },
      weightSubs: {},
      lastCoaccess: u.lastTime
    }));
    
    if (payloads.length > 0) {
      await syncFederatedSynapses(userId, 'server-node', payloads);
      await publishEvent(userId, 'hebbian', 'HEBBIAN_TRACES_UPDATED', { updatedCount: payloads.length });
    }
    
    span.setStatus({ code: SpanStatusCode.OK });`
);

content = content.replace(
`export async function pruneWeakEdges(userId: string, threshold: number = 0.1) {
  const span = tracer.startSpan('pruneWeakEdges');
  try {
    
    const edgesRef = db.collection(\`users/\${userId}/hebbianEdges\`);
    
    // Apply decay to all edges based on time since lastCoaccess
    const snapshot = await edgesRef.get();
    const now = Date.now();
    const batch = db.batch();
    let prunedCount = 0;
    
    snapshot.docs.forEach((doc: any) => {
      const edge = doc.data() as HebbianEdge;
      const hoursSince = (now - edge.lastCoaccess) / (1000 * 60 * 60);
      const decay = Math.exp(-0.02 * hoursSince); // Decay rate
      const newTrace = edge.trace * decay;
      
      if (newTrace < threshold) {
        batch.delete(doc.ref);
        prunedCount++;
      } else {
        batch.set(doc.ref, { trace: newTrace }, { merge: true });
      }
    });
    
    await batch.commit();
    if (prunedCount > 0) {
      await publishEvent(userId, 'hebbian', 'WEAK_EDGES_PRUNED', { prunedCount, threshold });
    }`,
`export async function pruneWeakEdges(userId: string, threshold: number = 0.1) {
  const span = tracer.startSpan('pruneWeakEdges');
  try {
    
    const edgesRef = db.collection(\`users/\${userId}/federatedSynapses\`);
    
    // Apply decay to all edges based on time since lastCoaccess
    const snapshot = await edgesRef.get();
    const now = Date.now();
    const batch = db.batch();
    let prunedCount = 0;
    
    snapshot.docs.forEach((doc: any) => {
      const payload = doc.data() as SynapticPayload;
      const crdt = new CRDTSynapse('server-node', [payload]);
      const currentTrace = crdt.getWeight(payload.source, payload.target);
      
      const hoursSince = (now - payload.lastCoaccess) / (1000 * 60 * 60);
      const decay = Math.exp(-0.02 * hoursSince); // Decay rate
      const newTrace = currentTrace * decay;
      
      if (newTrace < threshold) {
        batch.delete(doc.ref);
        prunedCount++;
      } else {
        // Logically we apply a subtractive weight to reflect decay
        const diff = currentTrace - newTrace;
        crdt.updateWeight(payload.source, payload.target, -diff, now);
        const updatedPayload = crdt.exportState()[0];
        batch.set(doc.ref, updatedPayload, { merge: true });
      }
    });
    
    await batch.commit();
    if (prunedCount > 0) {
      await publishEvent(userId, 'hebbian', 'WEAK_EDGES_PRUNED', { prunedCount, threshold });
    }`
);

content = content.replace(
`    const edgesRef = db.collection(\`users/\${userId}/hebbianEdges\`);
    
    // Only core or longTerm memories
    const activeSnap = await memRef.where('state', 'in', ['core', 'longTerm']).get();
    const memories = activeSnap.docs.map((d: any) => ({ id: d.id, ...d.data() } as MemoryNode));
    
    if (memories.length < 2) {
      span.setStatus({ code: SpanStatusCode.OK });
      span.end();
      return;
    }
    
    const edgesSnap = await edgesRef.get();
    const edges = edgesSnap.docs.map((d: any) => d.data() as HebbianEdge);
    const linkedPairs = new Set(edges.map((e: any) => e.source < e.target ? \`\${e.source}_\${e.target}\` : \`\${e.target}_\${e.source}\`));`,
`    const edgesRef = db.collection(\`users/\${userId}/federatedSynapses\`);
    
    // Only core or longTerm memories
    const activeSnap = await memRef.where('state', 'in', ['core', 'longTerm']).get();
    const memories = activeSnap.docs.map((d: any) => ({ id: d.id, ...d.data() } as MemoryNode));
    
    if (memories.length < 2) {
      span.setStatus({ code: SpanStatusCode.OK });
      span.end();
      return;
    }
    
    const edgesSnap = await edgesRef.get();
    const edges = edgesSnap.docs.map((d: any) => d.data() as SynapticPayload);
    const crdtHelper = new CRDTSynapse('server-node');
    const linkedPairs = new Set(edges.map((e: any) => crdtHelper.edgeId(e.source, e.target)));`
);

content = content.replace(
`            // Create links
            const edge1Id = bridgeId < m1.id ? \`\${bridgeId}_\${m1.id}\` : \`\${m1.id}_\${bridgeId}\`;
            const edge2Id = bridgeId < m2.id ? \`\${bridgeId}_\${m2.id}\` : \`\${m2.id}_\${bridgeId}\`;
            
            await edgesRef.doc(edge1Id).set({ id: edge1Id, source: bridgeId, target: m1.id, trace: 0.5, lastCoaccess: Date.now() });
            await edgesRef.doc(edge2Id).set({ id: edge2Id, source: bridgeId, target: m2.id, trace: 0.5, lastCoaccess: Date.now() });
            
            linkedPairs.add(pairId); // Prevent duplicate bridge for this pair`,
`            // Create links via CRDT
            const nowTime = Date.now();
            const bridgePayload1 = {
              source: bridgeId,
              target: m1.id,
              weightAdds: { 'server-node': 0.5 },
              weightSubs: {},
              lastCoaccess: nowTime
            };
            const bridgePayload2 = {
              source: bridgeId,
              target: m2.id,
              weightAdds: { 'server-node': 0.5 },
              weightSubs: {},
              lastCoaccess: nowTime
            };
            
            await syncFederatedSynapses(userId, 'server-node', [bridgePayload1, bridgePayload2]);
            
            linkedPairs.add(pairId); // Prevent duplicate bridge for this pair`
);

fs.writeFileSync('src/lib/hebbian.ts', content);
