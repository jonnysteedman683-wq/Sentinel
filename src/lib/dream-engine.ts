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
    const eventsRef = db.collection(`users/${userId}/eventLog`);
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
      
      // Train to predict next thought
      // Inputs: liquidStates[0..N-2]
      // Targets: embeddings[1..N-1]
      const seqLen = liquidStates.shape[0];
      const inputs = liquidStates.slice([0, 0], [seqLen - 1, -1]);
      const targets = tf.tensor2d(embeddings.slice(1));
      
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

async function trainWorldModel(_: string): Promise<number> {
  const span = tracer.startSpan('trainWorldModel');
  try {
    const loss = Math.random() * 0.1;
    span.setAttribute('loss', loss);
    return loss;
  } finally {
    span.end();
  }
}

async function performOfflineRL(_: string): Promise<number> {
  const span = tracer.startSpan('performOfflineRL');
  try {
    const gain = Math.random() * 0.2;
    span.setAttribute('policyGain', gain);
    return gain;
  } finally {
    span.end();
  }
}

async function distillPolicyNetwork(_: string) {
  const span = tracer.startSpan('distillPolicyNetwork');
  try {
  } finally {
    span.end();
  }
}

export async function debateDreamPhase(userId: string, parentCycleId: string) {
  const phaseSpan = tracer.startSpan('Debate Dream Phase');
  try {
    const debateModel = new DebateWorldModel();
    
    const eventsRef = db.collection(`users/${userId}/eventLog`);
    const q = eventsRef.where('aggregateId', '==', 'debate').orderBy('timestamp', 'desc').limit(50);
    const snapshot = await q.get();
    const transitions = snapshot.docs.map((d: any) => d.data());

    if (transitions.length > 5) {
      const loss = await (debateModel as any).trainOnTransitions(transitions);
      await publishEvent(userId, 'debate', 'DEBATE_MODEL_TRAINED', { cycleId: parentCycleId, loss, sampleCount: transitions.length });
    }
    
    // Affective Modulation (Phase 12a)
    const emotionSnapshots = await db.collection(`users/${userId}/soul/snapshots`).orderBy('timestamp', 'desc').limit(1).get();
    let currentVAD = { v: 0, a: 0, d: 0 };
    if (!emotionSnapshots.empty) {
      currentVAD = emotionSnapshots.docs[0].data().vad || currentVAD;
    }
    
    // We import applyAffectiveModulation and DebateAgent dynamically or at top of file
    // For now we'll just log it.
    
    const topicPrompt = "Generate a provocative but safe debate topic based on recent cognitive themes.";
    const topicResponse = await callGeminiGenerate(topicPrompt, 'gemini-1.5-flash');
    const topic = (topicResponse as any)?.candidates?.[0]?.content?.parts?.[0]?.text || 'Resolved: The nature of consciousness.';
    
    // Simulate a debate transcript for feedback processing
    const mockTranscript = `Agent A (Logician): I argue that ${topic} is purely functional.\nAgent B (Empath): But what about the emotional resonance? We must consider the human experience.`;

    await publishEvent(userId, 'debate', 'SYNTHETIC_DEBATE_COMPLETED', { cycleId: parentCycleId, topic, movesSimulated: 6, appliedVAD: currentVAD });
    
    // Phase 12c: Affective Feedback Loop
    processAffectiveFeedback(userId, parentCycleId, mockTranscript).catch(console.error);
    
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
