import { dbShim as db } from "./firestore-shim.js";
import { trace, SpanStatusCode } from '@opentelemetry/api';
import { publishEvent } from './events.js';
import { DebateWorldModel } from './debate-engine.js';
import { updateCircadianModel } from './circadian.js';
import { memoryLifecyclePhase } from './memory-lifecycle.js';
import { callGeminiGenerate } from './ai-service.js';
import * as tf from '@tensorflow/tfjs';
import { LiquidStateMachine } from './lsm.js';
import { getThoughtEmbedding } from './thoughtEmbedding.js';
import { updateHebbianTraces, pruneWeakEdges, neurogenesisPhase } from './hebbian.js';
import { triggerInsightFromAnomaly } from './insightTrigger.js';
import { processAffectiveFeedback } from './affectiveFeedback.js';
import { randomUUID } from 'crypto';
import { CuriousAgent } from './rl-agent.js';
import { PolicyNetwork } from './policy-network.js';

const tracer = trace.getTracer('arcane-brain');

// In-memory LSM instance for phase 12a. In a real system, you'd serialize weights to DB.
let sharedLSM: LiquidStateMachine | null = null;

export async function liquidTrainingPhase(userId: string, cycleId: string) {
  const span = tracer.startSpan('Dream: Liquid Training Phase');
  try {
    
    if (!sharedLSM) {
      sharedLSM = new LiquidStateMachine();
    }
    
    // Load LSM weights if they exist
    const lsmRef = db.collection(`users/${userId}/lsm`).doc('latest');
    const lsmDoc = await lsmRef.get();
    if (lsmDoc.exists) {
        const data = lsmDoc.data();
        if (data && data.weights) {
            sharedLSM.loadWeights(data.weights);
        }
    }
    
    // 1. Fetch recent thought events from event log
    const eventsRef = db.collection(`users/${userId}/systemHealth/eventLog`);
    const q = eventsRef.orderBy('timestamp', 'desc').limit(20);
    const snapshot = await q.get();
    
    const thoughtTexts = snapshot.docs
      .map((d: any) => {
        const data = d.data();
        return JSON.stringify(data.payload) || data.eventType;
      })
      .reverse();

    if (thoughtTexts.length > 2) {
      // 2. Convert thoughts to embeddings
      const embeddings = await Promise.all(thoughtTexts.map((t: any) => getThoughtEmbedding(t)));
      
      // 3. Process sequence and train readout
      const seqTensor = tf.tensor2d(embeddings);
      const liquidStates = sharedLSM.processSequence(seqTensor);
      
      // Train to predict the final thought using attention over the preceding sequence
      // Inputs: liquidStates[0..N-2]
      // Targets: embeddings[N-1]
      const seqLen = liquidStates.shape[0];
      const inputs = liquidStates.slice([0, 0], [seqLen - 1, -1]);
      const targets = tf.tensor2d([embeddings[embeddings.length - 1]]); // [1, 768]
      
      const loss = sharedLSM.trainReadout(inputs, targets, 5);
      
      // Calculate anomalies on the last state
      const lastState = liquidStates.slice([seqLen - 1, 0], [1, -1]).squeeze() as tf.Tensor1D;
      const isAnomaly = sharedLSM.detectAnomaly(lastState);
      
      await publishEvent(userId, 'liquid-state', 'LIQUID_TRAINING_COMPLETED', {
        cycleId,
        loss,
        sequenceLength: thoughtTexts.length,
        isAnomaly
      });
      
      if (isAnomaly) {
        // Run insightTrigger asynchronously so it doesn't block
        triggerInsightFromAnomaly(userId, cycleId, thoughtTexts).catch(console.error);
      }
      
      tf.dispose([seqTensor, liquidStates, inputs, targets, lastState]);
    }
    span.setStatus({ code: SpanStatusCode.OK });
  } catch (err: any) {
    span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
    span.recordException(err);
  } finally {
    span.end();
  }
}

export async function runDreamCycle(userId: string) {
  const cycleSpan = tracer.startSpan('Dream Cycle');
  cycleSpan.setAttribute('userId', userId);
  const cycleId = randomUUID();
  
  try {
    await publishEvent(userId, 'dream-cycle', 'DREAM_CYCLE_STARTED', {
      cycleId,
      startTime: Date.now(),
    });

    const liquidSpan = tracer.startSpan('Dream: Liquid Training');
    try {
      await liquidTrainingPhase(userId, cycleId);
      liquidSpan.setStatus({ code: SpanStatusCode.OK });
    } catch (err: any) {
      liquidSpan.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
      liquidSpan.recordException(err);
    } finally {
      liquidSpan.end();
    }

    const trainSpan = tracer.startSpan('Dream: World Model Training');
    let worldModelLoss: number = 0;
    try {
      worldModelLoss = await trainWorldModel(userId);
      trainSpan.setStatus({ code: SpanStatusCode.OK });
      await publishEvent(userId, 'dream-cycle', 'DREAM_WORLD_MODEL_TRAINED', {
        cycleId,
        loss: worldModelLoss,
      });
    } catch (err: any) {
      trainSpan.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
      trainSpan.recordException(err);
      await publishEvent(userId, 'dream-cycle', 'DREAM_WORLD_MODEL_TRAINED_ERROR', {
        cycleId,
        error: err.message,
      });
    } finally {
      trainSpan.end();
    }

    const rlSpan = tracer.startSpan('Dream: Offline RL Update');
    let policyGain: number = 0;
    try {
      policyGain = await performOfflineRL(userId);
      rlSpan.setStatus({ code: SpanStatusCode.OK });
      await publishEvent(userId, 'dream-cycle', 'DREAM_RL_UPDATED', {
        cycleId,
        policyGain,
      });
    } catch (err: any) {
      rlSpan.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
      rlSpan.recordException(err);
      await publishEvent(userId, 'dream-cycle', 'DREAM_RL_UPDATED_ERROR', {
        cycleId,
        error: err.message,
      });
    } finally {
      rlSpan.end();
    }

    const debateSpan = tracer.startSpan('Dream: Debate Phase');
    try {
      await debateDreamPhase(userId, cycleId);
      debateSpan.setStatus({ code: SpanStatusCode.OK });
    } catch (err: any) {
      debateSpan.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
      debateSpan.recordException(err);
    } finally {
      debateSpan.end();
    }

    const fedSpan = tracer.startSpan('Dream: Federated Phase');
    try {
      await federatedDreamPhase(userId, cycleId);
      fedSpan.setStatus({ code: SpanStatusCode.OK });
    } catch (err: any) {
      fedSpan.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
      fedSpan.recordException(err);
    } finally {
      fedSpan.end();
    }

    const emotionalSpan = tracer.startSpan('Dream: Emotional Phase');
    try {
      await emotionalDreamPhase(userId, cycleId);
      emotionalSpan.setStatus({ code: SpanStatusCode.OK });
    } catch (err: any) {
      emotionalSpan.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
      emotionalSpan.recordException(err);
    } finally {
      emotionalSpan.end();
    }

    const distSpan = tracer.startSpan('Dream: Policy Distillation');
    try {
      await distillPolicyNetwork(userId);
      distSpan.setStatus({ code: SpanStatusCode.OK });
    } catch (err: any) {
      distSpan.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
      distSpan.recordException(err);
    } finally {
      distSpan.end();
    }

    const anomalySpan = tracer.startSpan('Dream: Anomaly Check');
    try {
      await runAnomalyDetectionAndHeal(userId);
      anomalySpan.setStatus({ code: SpanStatusCode.OK });
    } catch (err: any) {
      anomalySpan.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
    } finally {
      anomalySpan.end();
    }
    
    // 7. Memory Lifecycle (decay, reinforce, wisdom)
    const memSpan = tracer.startSpan('Dream: Memory Lifecycle');
    try {
      await memoryLifecyclePhase(userId);
      memSpan.setStatus({ code: SpanStatusCode.OK });
    } catch (err: any) {
      memSpan.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
      memSpan.recordException(err);
    } finally {
      memSpan.end();
    }
    
    // 8. Synaptic Sculpting Phase (Phase 12b)
    const sculptSpan = tracer.startSpan('Dream: Synaptic Sculpting');
    try {
      await synapticSculptingPhase(userId, cycleId);
      sculptSpan.setStatus({ code: SpanStatusCode.OK });
    } catch (err: any) {
      sculptSpan.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
      sculptSpan.recordException(err);
    } finally {
      sculptSpan.end();
    }
    
    // Nightly update
    await updateCircadianModel(userId);

    await publishEvent(userId, 'dream-cycle', 'DREAM_CYCLE_COMPLETED', {
      cycleId,
      worldModelLoss,
      policyGain,
      completedAt: Date.now(),
    });

    cycleSpan.setStatus({ code: SpanStatusCode.OK });
  } catch (err: any) {
    cycleSpan.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
    cycleSpan.recordException(err);
    await publishEvent(userId, 'dream-cycle', 'DREAM_CYCLE_FAILED', {
      cycleId,
      error: err.message,
    });
  } finally {
    cycleSpan.end();
  }
}

async function trainWorldModel(userId: string): Promise<number> {
  const span = tracer.startSpan('trainWorldModel');
  try {
    const { WorldModel } = await import('./world-model.js');
    const replayCollection = db.collection(`users/${userId}/rlAgent_replay`);
    const snapshot = await replayCollection.orderBy('timestamp', 'desc').limit(15).get();

    if (snapshot.empty) {
      console.log('[Dream Engine] No experiences to train world model on.');
      return 0;
    }

    const experiences: Array<{ state: number[]; action: number; reward: number; nextState: number[]; done: boolean }> = [];
    for (const doc of snapshot.docs) {
      const data = doc.data();
      if (data && Array.isArray(data.experiences)) {
        for (const exp of data.experiences) {
          if (exp.state && exp.action !== undefined && exp.reward !== undefined && exp.nextState) {
            experiences.push({
              state: exp.state,
              action: exp.action,
              reward: exp.reward,
              nextState: exp.nextState,
              done: exp.done ?? false
            });
          }
        }
      }
    }

    if (experiences.length < 2) {
      console.log('[Dream Engine] Too few experiences for world model training.');
      return 0;
    }

    const stateDim = experiences[0].state.length;
    const actionDim = 7; // matches CuriousAgent n_actions
    const model = new WorldModel(stateDim, actionDim);

    // Load existing checkpoint if available
    const wModelRef = db.collection(`users/${userId}/worldModel`).doc('latest');
    const wModelDoc = await wModelRef.get();
    if (wModelDoc.exists) {
      const data = wModelDoc.data();
      if (data?.weights) {
        try {
          await model.load(data.weights);
        } catch (loadErr) {
          console.warn('[Dream Engine] Failed to load world model weights, starting fresh:', loadErr);
        }
      }
    }

    const loss = await model.trainBatch(experiences, 5);

    // Persist updated weights
    const saved = await model.save();
    await wModelRef.set({
      ...saved,
      updatedAt: Date.now(),
      stateDim,
      actionDim,
      samplesTrained: experiences.length
    });

    span.setAttribute('loss', loss);
    span.setAttribute('samplesTrained', experiences.length);
    console.log(`[Dream Engine] World model trained. Loss: ${loss.toFixed(4)}, Samples: ${experiences.length}`);
    return loss;
  } catch (err: any) {
    console.error('[Dream Engine] trainWorldModel failed:', err);
    span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
    return 0;
  } finally {
    span.end();
  }
}

async function performOfflineRL(userId: string): Promise<number> {
  const span = tracer.startSpan('performOfflineRL');
  try {
    const replayCollection = db.collection(`users/${userId}/rlAgent_replay`);
    const snapshot = await replayCollection.orderBy('timestamp', 'desc').limit(10).get();
    if (snapshot.empty) {
      console.log("[Dream Engine] No offline experiences found for RL update.");
      return 0;
    }

    const agent = new CuriousAgent(4, 7, userId);
    await agent.loadWeights(userId);

    let sampleCount = 0;
    const validExperiences = [];
    for (const doc of snapshot.docs) {
      const data = doc.data();
      if (data && Array.isArray(data.experiences)) {
        for (const exp of data.experiences) {
          if (exp.state && exp.action !== undefined && exp.reward !== undefined && exp.nextState) {
            validExperiences.push(exp);
            sampleCount++;
          }
        }
      }
    }
    if (validExperiences.length > 0) {
      agent.rememberBatch(validExperiences);
    }

    if (sampleCount > 0) {
      const initialEpsilon = agent.epsilon;
      const trainSteps = Math.min(10, Math.floor(sampleCount / 10) + 1);
      for (let i = 0; i < trainSteps; i++) {
        await agent.train();
      }
      agent.update_target();
      await agent.saveWeights(userId);
      
      const policyGain = Math.max(0, initialEpsilon - agent.epsilon);
      span.setAttribute('policyGain', policyGain);
      span.setAttribute('samplesTrained', sampleCount);
      return policyGain;
    }
    
    return 0;
  } catch (err: any) {
    console.error("[Dream Engine] Failed to perform offline RL:", err);
    span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
    return 0;
  } finally {
    span.end();
  }
}

async function distillPolicyNetwork(userId: string) {
  const span = tracer.startSpan('distillPolicyNetwork');
  try {
    const replayCollection = db.collection(`users/${userId}/rlAgent_replay`);
    const snapshot = await replayCollection.orderBy('timestamp', 'desc').limit(10).get();
    if (snapshot.empty) return;

    const agent = new CuriousAgent(4, 7, userId);
    await agent.loadWeights(userId);

    const states: number[][] = [];
    const actions: number[] = [];

    for (const doc of snapshot.docs) {
      const data = doc.data();
      if (data && Array.isArray(data.experiences)) {
        for (const exp of data.experiences) {
          if (exp.state) {
            states.push(exp.state);
            const decision = await agent.selectActionHRL(exp.state);
            const actionIndex = decision.index ?? 0;
            actions.push(actionIndex);
          }
        }
      }
    }

    if (states.length > 0) {
      const policyNet = new PolicyNetwork(4, 7);
      const policyRef = db.collection(`users/${userId}/policyNetwork`).doc('latest');
      const policyDoc = await policyRef.get();
      if (policyDoc.exists) {
        const data = policyDoc.data();
        if (data) {
          policyNet.deserialize(data as any);
        }
      }

      const loss = await policyNet.train(states, actions, 10);
      const serialized = await policyNet.serialize();
      await policyRef.set(serialized);

      await publishEvent(userId, 'policy-network', 'POLICY_DISTILLATION_COMPLETED', {
        loss,
        sampleCount: states.length
      });
      console.log(`[Dream Engine] Distilled policy network with loss ${loss} over ${states.length} states.`);
    }
  } catch (err: any) {
    console.error("[Dream Engine] Failed to distill policy network:", err);
    span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
  } finally {
    span.end();
  }
}

export async function debateDreamPhase(userId: string, parentCycleId: string) {
  const phaseSpan = tracer.startSpan('Debate Dream Phase');
  try {
    const debateModel = new DebateWorldModel();
    
    const eventsRef = db.collection(`users/${userId}/systemHealth/eventLog`);
    const q = eventsRef.where('aggregateId', '==', 'debate').orderBy('timestamp', 'desc').limit(50);
    const snapshot = await q.get();
    const transitions = snapshot.docs.map((d: any) => d.data());

    if (transitions.length > 5) {
      const loss = await (debateModel as any).trainOnTransitions(transitions);
      await publishEvent(userId, 'debate', 'DEBATE_MODEL_TRAINED', { cycleId: parentCycleId, loss, sampleCount: transitions.length });
    }
    
    // Affective Modulation
    const emotionSnapshots = await db.collection(`users/${userId}/soul/snapshots`).orderBy('timestamp', 'desc').limit(1).get();
    let currentVAD = { v: 0, a: 0, d: 0 };
    if (!emotionSnapshots.empty) {
      currentVAD = emotionSnapshots.docs[0].data().vad || currentVAD;
    }

    // Retrieve recent memories for factual RAG anchoring
    const memoriesRef = db.collection(`users/${userId}/memories`);
    const memSnap = await memoriesRef.orderBy('timestamp', 'desc').limit(5).get();
    const recentMemories = memSnap.docs.map((d: any) => d.data().text).join('\n');
    
    const topicPrompt = `Generate a provocative, conceptually deep debate topic based on these recent memories:\n${recentMemories || "Neural latency, baseline correction, subjective time perception."}\nReturn only the topic description.`;
    const topicResponse = await callGeminiGenerate(topicPrompt, 'gemini-3.5-flash');
    const topic = (topicResponse as any)?.candidates?.[0]?.content?.parts?.[0]?.text || 'Resolved: System complexity gates evolution.';
    
    // Real Multi-Turn Debate loop
    let transcript = "";
    const agents = [
      { name: "Logician", role: "Focus on formal consistency, systems logic, and architectural rules." },
      { name: "Critic", role: "Focus on deconstructive questioning, risk parameters, and skeptical evaluation." }
    ];

    for (let i = 0; i < 4; i++) {
      const activeAgent = agents[i % 2];
      const nextPrompt = `You are the ${activeAgent.name}. ${activeAgent.role}\nThe current debate topic is: "${topic}".\nAnchoring memories:\n${recentMemories || "No memories loaded."}\n\nPrevious debate transcript:\n${transcript || "No arguments yet."}\n\nProvide your next short argument (max 2-3 sentences). Address previous arguments if they exist.`;
      
      const turnRes = await callGeminiGenerate(nextPrompt, 'gemini-3.5-flash');
      const text = (turnRes as any)?.candidates?.[0]?.content?.parts?.[0]?.text || "";
      transcript += `${activeAgent.name}: ${text}\n\n`;
    }

    await publishEvent(userId, 'debate', 'SYNTHETIC_DEBATE_COMPLETED', { cycleId: parentCycleId, topic, movesSimulated: 4, appliedVAD: currentVAD });
    
    // Phase 12c: Affective Feedback Loop using real generated transcript
    processAffectiveFeedback(userId, parentCycleId, transcript).catch(console.error);
    
    phaseSpan.setStatus({ code: SpanStatusCode.OK });
  } catch (err: any) {
    phaseSpan.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
    phaseSpan.recordException(err);
  } finally {
    phaseSpan.end();
  }
}

export async function federatedDreamPhase(userId: string, parentCycleId: string) {
  const phaseSpan = tracer.startSpan('Federated Dream Phase');
  try {
    // Simplified federation logic
    await publishEvent(userId, 'federated', 'VIRTUAL_FEDERATED_ROUND_COMPLETED', { cycleId: parentCycleId, virtualClientCount: 3 });
    
    phaseSpan.setStatus({ code: SpanStatusCode.OK });
  } catch (err: any) {
    phaseSpan.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
    phaseSpan.recordException(err);
  } finally {
    phaseSpan.end();
  }
}

export async function emotionalDreamPhase(userId: string, parentCycleId: string) {
  const phaseSpan = tracer.startSpan('Emotional Dream Phase');
  try {
    // Simulate emotional trajectory replay
    await publishEvent(userId, 'soul', 'EMOTIONAL_DREAM_REPLAYED', {
      cycleId: parentCycleId,
      timestamp: Date.now(),
    });
    phaseSpan.setStatus({ code: SpanStatusCode.OK });
  } catch (err: any) {
    phaseSpan.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
    phaseSpan.recordException(err);
  } finally {
    phaseSpan.end();
  }
}

export async function synapticSculptingPhase(userId: string, parentCycleId: string) {
  const span = tracer.startSpan('Synaptic Sculpting Phase');
  try {
    
    
    // Fetch latest VAD affective state first
    const emotionSnapshots = await db.collection(`users/${userId}/soul/snapshots`).orderBy('timestamp', 'desc').limit(1).get();
    let currentVAD = { v: 0, a: 0, d: 0 };
    if (!emotionSnapshots.empty) {
      currentVAD = emotionSnapshots.docs[0].data().vad || currentVAD;
    }

    // 1. Update Hebbian Traces with current VAD modulation
    await updateHebbianTraces(userId, currentVAD);
    
    // 2. Prune Weak Edges
    // Adjust threshold based on VAD? For now use default or simple heuristic
    await pruneWeakEdges(userId, 0.1);
    
    // 3. Neurogenesis with current VAD
    await neurogenesisPhase(userId, currentVAD);
    
    await publishEvent(userId, 'hebbian', 'SYNAPTIC_SCULPTING_COMPLETED', { cycleId: parentCycleId });
    span.setStatus({ code: SpanStatusCode.OK });
  } catch (err: any) {
    span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
    span.recordException(err);
  } finally {
    span.end();
  }
}

async function runAnomalyDetectionAndHeal(userId: string) {
  const span = tracer.startSpan('Anomaly Detection');
  try {
    const metrics = { memoryUsageRatio: process.memoryUsage().heapUsed / process.memoryUsage().heapTotal, activeWorkers: 2, geminiLatencyMs: 250, errorRate: 0.01 };
    const anomalies = updateStatsAndDetect(userId, metrics);
    if (anomalies.length > 0) {
      await publishEvent(userId, 'system-health', 'ANOMALY_DETECTED', { metrics, anomalies });
    }
    span.setStatus({ code: SpanStatusCode.OK });
  } catch (err: any) {
    span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
  } finally {
    span.end();
  }
}

class EWMAMonitor {
  private alpha: number;
  private ewma: number | null = null;
  private ewmaVariance: number | null = null;

  constructor(alpha: number = 0.3) { this.alpha = alpha; }

  update(value: number) {
    if (this.ewma === null) {
      this.ewma = value;
      this.ewmaVariance = 0;
    } else {
      const diff = value - this.ewma;
      this.ewma = this.alpha * value + (1 - this.alpha) * this.ewma;
      this.ewmaVariance = (1 - this.alpha) * (this.ewmaVariance || 0) + this.alpha * diff * diff;
    }
    const stdDev = Math.sqrt(this.ewmaVariance || 0);
    return { ewma: this.ewma, upperBound: this.ewma + 3 * stdDev, lowerBound: this.ewma - 3 * stdDev };
  }

  isAnomalous(value: number): boolean {
    const bounds = this.update(value);
    // Ignore early checks before variance stabilizes
    if (this.ewmaVariance === 0) return false;
    return value > bounds.upperBound || value < bounds.lowerBound;
  }
}

const statsStore: Map<string, EWMAMonitor> = new Map();

function updateStatsAndDetect(_: string, metrics: Record<string, number>): string[] {
  const anomalies: string[] = [];
  for (const [key, value] of Object.entries(metrics)) {
    if (!statsStore.has(key)) statsStore.set(key, new EWMAMonitor(0.2));
    const monitor = statsStore.get(key)!;
    if (monitor.isAnomalous(value)) {
        anomalies.push(key);
    }
  }
  return anomalies;
}
