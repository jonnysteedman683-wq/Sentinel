import { dbShim as db } from "./firestore-shim.js";
import { CuriousAgent } from "./rl-agent.js";
import { trace, SpanStatusCode } from '@opentelemetry/api';
import { localDb } from './local-db.js';

const tracer = trace.getTracer('arcane-brain');

// We use the RL agent to rank the most probable next actions/states
export async function runPredictivePrefetch(userId: string, agent: CuriousAgent) {
  const span = tracer.startSpan('runPredictivePrefetch');
  try {
    const currentState = agent.getState();
    if (!currentState || currentState.length === 0) {
      span.setStatus({ code: SpanStatusCode.OK });
      span.end();
      return;
    }
    
    // Get Q-values for all actions
    // Since CuriousAgent uses an HRL or base DQN, we can get top level Q values
    const q_values = await agent.getQValues(currentState);
    
    // Sort actions by Q-value descending
    const actionRanking = q_values
      .map((q: number, idx: number) => ({ action: idx, q }))
      .sort((a: {q: number}, b: {q: number}) => b.q - a.q);
      
    // Take top 3 predicted actions
    const topActions = actionRanking.slice(0, 3).map((a: {action: number}) => a.action);
    
    // For AQB, let's pre-fetch memory collections based on the inferred context.
    const prefetchPromises = [];
    for (const action of topActions) {
      // Determine target state based on action index heuristics
      let targetState = '';
      if (action === 0 || action === 1) targetState = 'core';
      else if (action === 2 || action === 3) targetState = 'shortTerm';
      else if (action === 4 || action === 5) targetState = 'wisdom';
      else targetState = 'longTerm';
      
      if (targetState) {
        // Hybrid sync: Check Dexie local cache first
        const p = (async () => {
          try {
            const cachedCount = await localDb.memories
              .where('[userId+state]')
              .equals([userId, targetState])
              .count();
              
            // Cache hit -> fast return
            if (cachedCount >= 10) return;
            
            // Cache miss -> fallback to Firestore
            const snapshot = await db.collection(`users/${userId}/memories`)
              .where('state', '==', targetState)
              .orderBy('lastAccessed', 'desc')
              .limit(10)
              .get();
              
            const docsToCache = snapshot.docs.map((doc: any) => ({
              id: doc.id,
              userId,
              state: targetState,
              content: doc.data().content || '',
              embedding: doc.data().embedding,
              lastAccessed: doc.data().lastAccessed || Date.now(),
              updatedAt: doc.data().updatedAt || Date.now()
            }));
            
            if (docsToCache.length > 0) {
              await localDb.memories.bulkPut(docsToCache);
            }
          } catch (err) {
            console.error(`Prefetch failed for state ${targetState}:`, err);
          }
        })();
        prefetchPromises.push(p);
      }
    }
    
    // Wait for network requests to populate cache
    await Promise.all(prefetchPromises);
    span.setStatus({ code: SpanStatusCode.OK });
  } catch (err: any) {
    span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
    span.recordException(err);
  } finally {
    span.end();
  }
}
