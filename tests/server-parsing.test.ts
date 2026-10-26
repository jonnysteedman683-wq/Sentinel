import { beforeAll, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// server.ts calls startServer() at import time. Neutralise every boot-time
// side effect (HTTP listen, rate-limiter / cron timers, voice gateway, Vite)
// via mocks so importing the module is inert and we can exercise its exported
// pure helpers. No production code is modified.
// ---------------------------------------------------------------------------
process.env.NODE_ENV = 'production'; // skip the dev-only Vite middleware branch

vi.mock('express', () => {
  const makeApp = () =>
    new Proxy(() => {}, {
      get: (_t, prop) => {
        // listen must NOT invoke its callback, or the boot sequence would
        // start the SelfHealingOrchestrator's interval and keep the process alive.
        if (prop === 'listen') return () => ({ close: () => {}, on: () => {} });
        return () => undefined; // use / get / post / put / delete / set ... no-ops
      },
    });
  const express: any = () => makeApp();
  express.static = () => (_req: any, _res: any, next?: any) => next?.();
  express.json = () => (_req: any, _res: any, next?: any) => next?.();
  express.urlencoded = () => (_req: any, _res: any, next?: any) => next?.();
  express.Router = () => makeApp();
  return { default: express };
});

vi.mock('node-cron', () => ({ default: { schedule: () => ({ stop: () => {} }) } }));

vi.mock('../src/lib/rate-limiter.js', () => ({
  rateLimiterMiddleware: () => (_req: any, _res: any, next?: any) => next?.(),
  startRateLimiterCleanup: vi.fn(),
  stopRateLimiterCleanup: vi.fn(),
}));

vi.mock('../src/lib/voice-gateway.js', () => ({ setupVoiceGateway: vi.fn() }));

type ServerModule = typeof import('../server.js');
let parseJsonWithFallback: ServerModule['parseJsonWithFallback'];
let parseRobustChatResponse: ServerModule['parseRobustChatResponse'];
let sendError: ServerModule['sendError'];

beforeAll(async () => {
  const mod = await import('../server.js');
  parseJsonWithFallback = mod.parseJsonWithFallback;
  parseRobustChatResponse = mod.parseRobustChatResponse;
  sendError = mod.sendError;
});

describe('parseJsonWithFallback', () => {
  it('parses a clean JSON object', () => {
    expect(parseJsonWithFallback('{"a":1,"b":"two"}', {})).toEqual({ a: 1, b: 'two' });
  });

  it('unwraps a ```json fenced code block', () => {
    const fenced = '```json\n{"ok":true}\n```';
    expect(parseJsonWithFallback(fenced, {})).toEqual({ ok: true });
  });

  it('unwraps a bare ``` fenced block', () => {
    expect(parseJsonWithFallback('```\n[1,2,3]\n```', [])).toEqual([1, 2, 3]);
  });

  it('extracts JSON that follows leading prose', () => {
    expect(parseJsonWithFallback('Here is the answer: {"x":true}', {})).toEqual({ x: true });
  });

  it('repairs a truncated object by closing open braces', () => {
    expect(parseJsonWithFallback('{"a":1,"b":2', {})).toEqual({ a: 1, b: 2 });
  });

  it('repairs a truncated nested structure', () => {
    expect(parseJsonWithFallback('{"list":[1,2', {})).toEqual({ list: [1, 2] });
  });

  it('returns the default value for unparseable input', () => {
    const fallback = { fallback: true };
    expect(parseJsonWithFallback('this is not json', fallback)).toBe(fallback);
  });

  it('returns a typed array default', () => {
    expect(parseJsonWithFallback('nonsense', [] as number[])).toEqual([]);
  });
});

describe('parseRobustChatResponse', () => {
  it('maps a well-formed structured response', () => {
    const raw = JSON.stringify({
      text: 'Hello world',
      selfAnalysis: 'thought about it',
      extractedMemory: 'user likes tea',
      extractedTags: ['tea', 'preference'],
      suggestedShortcuts: ['/tea'],
      systemUI: 'panel',
      systemUIData: { rows: 2 },
      cognitiveLog: {
        draft: 'd',
        recollection: 'r',
        reflection: 'f',
        reiteration: 'i',
      },
    });
    const parsed = parseRobustChatResponse(raw);
    expect(parsed.text).toBe('Hello world');
    expect(parsed.selfAnalysis).toBe('thought about it');
    expect(parsed.extractedMemory).toBe('user likes tea');
    expect(parsed.extractedTags).toEqual(['tea', 'preference']);
    expect(parsed.suggestedShortcuts).toEqual(['/tea']);
    expect(parsed.systemUI).toBe('panel');
    expect(parsed.systemUIData).toEqual({ rows: 2 });
    expect(parsed.cognitiveLog).toEqual({ draft: 'd', recollection: 'r', reflection: 'f', reiteration: 'i' });
  });

  it('unwraps a fenced JSON response', () => {
    const parsed = parseRobustChatResponse('```json\n{"text":"fenced reply"}\n```');
    expect(parsed.text).toBe('fenced reply');
  });

  it('ignores an extractedMemory sentinel of "null" or "none"', () => {
    expect(parseRobustChatResponse('{"text":"hi","extractedMemory":"null"}').extractedMemory).toBeNull();
    expect(parseRobustChatResponse('{"text":"hi","extractedMemory":"none"}').extractedMemory).toBeNull();
  });

  it('stringifies a non-string text field', () => {
    const parsed = parseRobustChatResponse('{"text":{"nested":"value"}}');
    expect(parsed.text).toBe('{"nested":"value"}');
  });

  it('treats a plain-text (non-JSON) response as the reply text', () => {
    expect(parseRobustChatResponse('Just a plain sentence.').text).toBe('Just a plain sentence.');
  });

  it('falls back to regex extraction when JSON parsing fails', () => {
    // Unescaped inner quotes make this invalid JSON that cleanJson cannot repair.
    const raw = '{"text": "he said "hi" to everyone"}';
    expect(parseRobustChatResponse(raw).text).toContain('he said');
  });

  it('promotes the cognitive draft to text when no text is recovered', () => {
    const raw = '{ not valid json, "draft": "reflective draft" }';
    const parsed = parseRobustChatResponse(raw);
    expect(parsed.cognitiveLog.draft).toBe('reflective draft');
    expect(parsed.text).toBe('reflective draft');
  });

  it('returns safe defaults for empty input', () => {
    const parsed = parseRobustChatResponse('');
    expect(parsed.extractedTags).toEqual([]);
    expect(parsed.suggestedShortcuts).toEqual([]);
    expect(parsed.extractedMemory).toBeNull();
  });
});

describe('sendError', () => {
  function makeRes() {
    const res: any = {};
    res.status = vi.fn((code: number) => {
      res.statusCode = code;
      return res;
    });
    res.json = vi.fn((body: any) => {
      res.body = body;
      return res;
    });
    return res;
  }

  const baseReq = () => ({ headers: { 'x-trace-id': 'trace-123' }, url: '/api/thing', method: 'POST' });

  it('defaults to HTTP 500 and wraps the error message', () => {
    const res = makeRes();
    sendError(baseReq(), res, new Error('boom'));
    expect(res.statusCode).toBe(500);
    expect(res.body.error.message).toBe('boom');
    expect(res.body.error.traceId).toBe('trace-123');
    expect(res.body.error.code).toBeTruthy();
    expect(typeof res.body.error.timestamp).toBe('number');
  });

  it('honours an explicit status override', () => {
    const res = makeRes();
    sendError(baseReq(), res, new Error('bad request'), 400);
    expect(res.statusCode).toBe(400);
  });

  it('uses the status carried on the error object', () => {
    const res = makeRes();
    sendError(baseReq(), res, { message: 'forbidden', status: 403 });
    expect(res.statusCode).toBe(403);
  });

  it('propagates an error code from the error object', () => {
    const res = makeRes();
    sendError(baseReq(), res, { message: 'oops', code: 'CUSTOM_CODE' });
    expect(res.body.error.code).toBe('CUSTOM_CODE');
  });

  it('falls back to req.id for the trace id when no header is present', () => {
    const res = makeRes();
    sendError({ headers: {}, id: 'req-id-9', url: '/api/x', method: 'GET' }, res, new Error('x'));
    expect(res.body.error.traceId).toBe('req-id-9');
  });
});
