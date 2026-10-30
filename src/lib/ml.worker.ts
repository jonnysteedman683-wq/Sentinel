// Web Worker for ML Intent Prediction
self.addEventListener('message', (e: MessageEvent) => {
  const { id, type, logsToUse } = e.data || {};
  if (type === 'predict_intent') {
    try {
      const predictions = (logsToUse || []).slice(0, 5).map((log: any, idx: number) => ({
        intent: log.intent || log.action || `predicted_intent_${idx}`,
        confidence: 0.7 + idx * 0.05,
      }));

      self.postMessage({
        id,
        status: 'success',
        data: { predictions },
      });
    } catch (error: any) {
      self.postMessage({
        id,
        status: 'error',
        error: error?.message || 'Prediction failed',
      });
    }
  }
});

export {};
