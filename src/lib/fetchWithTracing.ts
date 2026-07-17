import { context, trace, SpanStatusCode, propagation } from '@opentelemetry/api';

export function fetchWithTracing(url: string, options: RequestInit = {}) {
  const webTracer = trace.getTracer('arcane-brain-ui');
  const span = webTracer.startSpan('client fetch');
  const headers = new Headers(options.headers || {});
  // Inject trace context
  const carrier: any = {};
  propagation.inject(
    context.active(),
    carrier,
    { set: (obj: any, key: string, val: string) => (obj[key] = val) }
  );
  if (carrier.traceparent) {
    headers.set('traceparent', carrier.traceparent);
  }
  const newOptions = { ...options, headers };
  span.setAttribute('http.url', url);
  return fetch(url, newOptions)
    .then(res => {
      span.setStatus({ code: res.ok ? SpanStatusCode.OK : SpanStatusCode.ERROR });
      span.end();
      return res;
    })
    .catch(err => {
      span.recordException(err);
      span.setStatus({ code: SpanStatusCode.ERROR });
      span.end();
      throw err;
    });
}
