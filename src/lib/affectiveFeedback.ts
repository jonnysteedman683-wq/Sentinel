import { SpanStatusCode, trace } from '@opentelemetry/api';
import type { EmotionSnapshot } from '../types.js';
import { callGeminiGenerate } from './ai-service.js';
import { publishEvent } from './events.js';
import { dbShim as db } from './firestore-shim.js';

const tracer = trace.getTracer('arcane-brain');

// Narrow shape of the GenAI generateContent response we read from.
type GenAiTextResponse = {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
};

export async function processAffectiveFeedback(
  userId: string,
  cycleId: string,
  debateTranscript: string,
) {
  const span = tracer.startSpan('processAffectiveFeedback');
  try {
    // Analyze transcript sentiment to get a VAD observation
    const prompt = `Analyze the emotional tone of this debate transcript. Output JSON only with "v" (valence, -1 to 1), "a" (arousal, -1 to 1), and "d" (dominance, -1 to 1). 
Transcript: ${debateTranscript}`;

    const response = await callGeminiGenerate(prompt, 'gemini-3.5-flash');
    const textContent =
      (response as GenAiTextResponse)?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';

    let observedVAD = { v: 0, a: 0, d: 0 };
    try {
      const match = textContent.match(/\\{.*?\\}/s);
      const jsonStr = match ? match[0] : textContent;
      const parsed = JSON.parse(jsonStr);
      if (parsed.v !== undefined) observedVAD = parsed;
    } catch {
      // Fallback if not parsable
    }

    // In a full implementation, this observation is fed into a Kalman filter.
    // Here we'll compute a delta based on the latest snapshot.
    const snapshotsRef = db.collection(`users/${userId}/soul/snapshots`);
    const lastSnap = await snapshotsRef.orderBy('timestamp', 'desc').limit(1).get();

    let currentVAD = { v: 0, a: 0, d: 0 };
    if (!lastSnap.empty) {
      currentVAD = lastSnap.docs[0].data().vad || currentVAD;
    }

    // Simple Kalman-like update (gain = 0.05)
    const gain = 0.05;
    const newVAD = {
      v: currentVAD.v + gain * (observedVAD.v - currentVAD.v),
      a: currentVAD.a + gain * (observedVAD.a - currentVAD.a),
      d: currentVAD.d + gain * (observedVAD.d - currentVAD.d),
    };

    const newSnapshot: EmotionSnapshot = {
      userId,
      vad: {
        valence: newVAD.v,
        arousal: newVAD.a,
        dominance: newVAD.d,
      },
      timestamp: Date.now(),
    };

    await snapshotsRef.add(newSnapshot);
    await publishEvent(userId, 'soul', 'AFFECTIVE_RESONANCE', {
      cycleId,
      oldVAD: currentVAD,
      newVAD,
      observedVAD,
    });

    span.setStatus({ code: SpanStatusCode.OK });
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
    span.recordException(error);
  } finally {
    span.end();
  }
}
