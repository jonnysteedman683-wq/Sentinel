import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the Firebase surface api.ts imports so no real SDK/network is touched.
// `auth.currentUser` is mutated per-test to drive the auth-header logic.
vi.mock('../../firebase.js', () => ({
  auth: { currentUser: null as any },
  db: {},
  collection: vi.fn(() => ({})),
  query: vi.fn(() => ({})),
  orderBy: vi.fn(() => ({})),
  limit: vi.fn(() => ({})),
  getDocs: vi.fn(async () => ({ empty: true, docs: [] })),
}));

import { auth, getDocs } from '../../firebase.js';
import {
  apiRequest,
  fetchInsight,
  fetchNudgeMemory,
  getLatestUnconsolidatedChatId,
  ingestTelemetry,
} from '../api.js';
import { AppError, AuthError, GeminiAPIError, ValidationError } from '../errors.js';

type MockResponse = { ok: boolean; status: number; body?: any; text?: string };

/**
 * Routes fetch calls: telemetry-ingest calls always succeed (they run as a
 * side effect on permanent failures); every other call returns `main`.
 */
function routeFetch(main: MockResponse) {
  return vi.fn(async (url: string, _init?: any) => {
    if (typeof url === 'string' && url.includes('/ingest-telemetry')) {
      return { ok: true, status: 200, json: async () => ({}), text: async () => '' };
    }
    return {
      ok: main.ok,
      status: main.status,
      json: async () => main.body,
      text: async () => main.text ?? '',
    };
  });
}

beforeEach(() => {
  (auth as any).currentUser = null;
  vi.mocked(getDocs).mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('apiRequest', () => {
  it('returns the parsed JSON body on success', async () => {
    global.fetch = routeFetch({ ok: true, status: 200, body: { value: 42 } }) as any;
    await expect(apiRequest('/chat')).resolves.toEqual({ value: 42 });
  });

  it('prefixes /api, injects a trace id and an empty bearer token when signed out', async () => {
    const fetchMock = routeFetch({ ok: true, status: 200, body: {} });
    global.fetch = fetchMock as any;
    await apiRequest('chat'); // no leading slash
    const [url, init] = fetchMock.mock.calls[0] as [string, any];
    expect(url).toBe('/api/chat');
    expect(init.headers.Authorization).toBe('Bearer ');
    expect(init.headers['X-Trace-Id']).toMatch(/^client-tr-/);
  });

  it('attaches the Firebase ID token when a user is signed in', async () => {
    (auth as any).currentUser = { getIdToken: async () => 'id-token-xyz' };
    const fetchMock = routeFetch({ ok: true, status: 200, body: {} });
    global.fetch = fetchMock as any;
    await apiRequest('/chat');
    const init = fetchMock.mock.calls[0][1] as any;
    expect(init.headers.Authorization).toBe('Bearer id-token-xyz');
  });

  it('maps 401 to AuthError', async () => {
    global.fetch = routeFetch({
      ok: false,
      status: 401,
      body: { error: { message: 'nope' } },
    }) as any;
    await expect(apiRequest('/secure')).rejects.toBeInstanceOf(AuthError);
  });

  it('maps 400 to ValidationError', async () => {
    global.fetch = routeFetch({
      ok: false,
      status: 400,
      body: { error: { message: 'bad' } },
    }) as any;
    await expect(apiRequest('/secure')).rejects.toBeInstanceOf(ValidationError);
  });

  it('maps 502 to GeminiAPIError', async () => {
    global.fetch = routeFetch({
      ok: false,
      status: 502,
      body: { error: { message: 'upstream' } },
    }) as any;
    await expect(apiRequest('/gen')).rejects.toBeInstanceOf(GeminiAPIError);
  });

  it('maps an unclassified 500 to a generic AppError', async () => {
    global.fetch = routeFetch({
      ok: false,
      status: 500,
      body: { error: { message: 'boom' } },
    }) as any;
    await expect(apiRequest('/gen')).rejects.toBeInstanceOf(AppError);
  });

  it('retries a transient 503 and resolves once it succeeds', async () => {
    let call = 0;
    global.fetch = vi.fn(async (url: string) => {
      if (typeof url === 'string' && url.includes('/ingest-telemetry')) {
        return { ok: true, status: 200, json: async () => ({}), text: async () => '' };
      }
      call++;
      if (call === 1)
        return { ok: false, status: 503, json: async () => ({}), text: async () => '' };
      return {
        ok: true,
        status: 200,
        json: async () => ({ recovered: true }),
        text: async () => '',
      };
    }) as any;
    await expect(apiRequest('/flaky')).resolves.toEqual({ recovered: true });
    expect(call).toBe(2);
  });
});

describe('api helpers', () => {
  it('fetchInsight unwraps the insight payload', async () => {
    const insight = { insight: 'be present', sources: ['m1'], confidence: 0.8 };
    global.fetch = routeFetch({ ok: true, status: 200, body: { insight } }) as any;
    await expect(fetchInsight()).resolves.toEqual(insight);
  });

  it('fetchNudgeMemory falls back to the strongest pinned local memory on failure', async () => {
    global.fetch = routeFetch({
      ok: false,
      status: 500,
      body: { error: { message: 'down' } },
    }) as any;
    const memories = [
      { id: 'a', text: 'a', timestamp: 1, strength: 0.4, pinned: true },
      { id: 'b', text: 'b', timestamp: 2, strength: 0.9, pinned: true },
      { id: 'c', text: 'c', timestamp: 3, strength: 0.99, pinned: false },
    ];
    const res = await fetchNudgeMemory(memories);
    expect(res?.id).toBe('b');
  });

  it('ingestTelemetry swallows network errors', async () => {
    global.fetch = vi.fn(async () => {
      throw new Error('offline');
    }) as any;
    await expect(ingestTelemetry({ type: 'X', data: {} })).resolves.toBeUndefined();
  });

  describe('getLatestUnconsolidatedChatId', () => {
    it('returns null when no user is signed in', async () => {
      (auth as any).currentUser = null;
      await expect(getLatestUnconsolidatedChatId()).resolves.toBeNull();
    });

    it('returns the id of the first unconsolidated chat', async () => {
      (auth as any).currentUser = { uid: 'u1' };
      vi.mocked(getDocs).mockResolvedValue({
        empty: false,
        docs: [
          { id: 'c1', data: () => ({ consolidated: true }) },
          { id: 'c2', data: () => ({ consolidated: false }) },
        ],
      } as any);
      await expect(getLatestUnconsolidatedChatId()).resolves.toBe('c2');
    });
  });
});
