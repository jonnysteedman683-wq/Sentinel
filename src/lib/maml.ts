import { RLWeightsDoc } from "../types.js";
import { trace, SpanStatusCode } from '@opentelemetry/api';

const tracer = trace.getTracer('arcane-brain');

/**
 * MAML (Model-Agnostic Meta-Learning) Persistence
 * Aggregates local RL policy gradients/weights into a global Meta-Model using a Reptile meta-step.
 */

/**
 * Recursively blends two values or structures using a convex combination (Reptile/EMA step):
 * Val = Meta * (1 - beta) + Local * beta
 */
export function blendAny(meta: any, local: any, beta: number): any {
  if (meta === null || meta === undefined) return local;
  if (local === null || local === undefined) return meta;

  // Handle nested JSON strings (common for serialized tensor weights)
  if (typeof meta === 'string' && typeof local === 'string') {
    try {
      const parsedMeta = JSON.parse(meta);
      const parsedLocal = JSON.parse(local);
      const blended = blendAny(parsedMeta, parsedLocal, beta);
      return JSON.stringify(blended);
    } catch {
      return local;
    }
  }

  // Handle numbers with epsilon floors and NaN checks for numerical stability
  if (typeof meta === 'number' && typeof local === 'number') {
    if (!Number.isFinite(meta)) return local;
    if (!Number.isFinite(local)) return meta;
    return meta * (1 - beta) + local * beta;
  }

  // Handle arrays recursively
  if (Array.isArray(meta) && Array.isArray(local)) {
    const len = Math.min(meta.length, local.length);
    const result = new Array(len);
    for (let i = 0; i < len; i++) {
      result[i] = blendAny(meta[i], local[i], beta);
    }
    return result;
  }

  // Handle objects recursively
  if (typeof meta === 'object' && typeof local === 'object') {
    const result: any = {};
    const keys = new Set([...Object.keys(meta), ...Object.keys(local)]);
    for (const key of keys) {
      if (key in meta && key in local) {
        result[key] = blendAny(meta[key], local[key], beta);
      } else if (key in local) {
        result[key] = local[key];
      } else {
        result[key] = meta[key];
      }
    }
    return result;
  }

  return local;
}

export async function syncMetaWeights(userId: string, localWeights: RLWeightsDoc) {
  const span = tracer.startSpan('syncMetaWeights');
  try {
    const response = await fetch('/api/maml/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, localWeights })
    });
    
    if (!response.ok) {
      throw new Error(`Failed to sync meta-weights: ${response.statusText}`);
    }
    
    span.setStatus({ code: SpanStatusCode.OK });
  } catch (err: any) {
    span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
    span.recordException(err);
  } finally {
    span.end();
  }
}
