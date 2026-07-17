import { diag, DiagConsoleLogger, DiagLogLevel, trace, SpanStatusCode } from '@opentelemetry/api';

diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.INFO);

// Global in-memory trace store
export const localTraces: Record<string, any[]> = {};

const baseTracer = trace.getTracer('arcane-brain');

export const tracer: any = {
  startSpan(name: string, options?: any) {
    const span = baseTracer.startSpan(name, options);
    const traceContext = span.spanContext();
    const traceId = traceContext.traceId;
    const spanId = traceContext.spanId;
    const startTime = Date.now();
    const attributes: Record<string, any> = {};
    const status = { code: SpanStatusCode.UNSET, message: '' };
    const events: any[] = [];

    const spanRecord = {
      name,
      traceId,
      spanId,
      startTime,
      endTime: null as number | null,
      attributes,
      status,
      events,
      durationMs: 0
    };

    if (!localTraces[traceId]) {
      localTraces[traceId] = [];
    }
    localTraces[traceId].push(spanRecord);

    // Keep memory size bounded
    const traceIds = Object.keys(localTraces);
    if (traceIds.length > 200) {
      delete localTraces[traceIds[0]];
    }

    return {
      setAttribute(key: string, value: any) {
        span.setAttribute(key, value);
        attributes[key] = value;
        return this;
      },
      setStatus(stat: { code: SpanStatusCode, message?: string }) {
        span.setStatus(stat);
        status.code = stat.code;
        status.message = stat.message || '';
        return this;
      },
      recordException(err: Error) {
        span.recordException(err);
        events.push({
          name: 'exception',
          time: Date.now(),
          attributes: {
            'exception.message': err.message,
            'exception.stack': err.stack
          }
        });
        return this;
      },
      end() {
        span.end();
        spanRecord.endTime = Date.now();
        spanRecord.durationMs = spanRecord.endTime - spanRecord.startTime;
      },
      spanContext() {
        return traceContext;
      }
    };
  }
};
