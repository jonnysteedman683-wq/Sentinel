import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { fetchLedgerRows, registerUniSyncMemoryRoute } from '../unisync-route.js';

const rows = readFileSync(path.join(__dirname, 'fixtures', 'unisync-ledger.jsonl'), 'utf8')
  .trim()
  .split('\n')
  .map((l) => JSON.parse(l));

type Handler = (req: any, res: any) => Promise<void> | void;

function mount(env: Record<string, string | undefined>, fetchImpl?: typeof fetch, now = () => 0) {
  let handler: Handler | undefined;
  registerUniSyncMemoryRoute(
    {
      get: (p: string, h: Handler) => {
        expect(p).toBe('/api/unisync/memory');
        handler = h;
      },
    },
    { env, fetchImpl, now },
  );
  return async (req: any) => {
    const res: any = { statusCode: 200, body: undefined };
    res.status = (c: number) => {
      res.statusCode = c;
      return res;
    };
    res.json = (b: unknown) => {
      res.body = b;
      return res;
    };
    if (!handler) throw new Error('route not registered');
    await handler(req, res);
    return res;
  };
}

const okFetch = () =>
  vi.fn(async () => new Response(JSON.stringify(rows), { status: 200 })) as unknown as typeof fetch;
const ENV = { UNISYNC_SUPABASE_URL: 'https://x.supabase.co/', UNISYNC_SUPABASE_KEY: 'k' };

describe('GET /api/unisync/memory', () => {
  it('requires a signed-in user unless the request is loopback', async () => {
    const call = mount(ENV, okFetch());
    expect((await call({ user: null, ip: '203.0.113.9' })).statusCode).toBe(401);
    expect((await call({ user: null, ip: '::1' })).statusCode).toBe(200);
  });

  it('degrades gracefully when not configured', async () => {
    const res = await mount({})({ user: { uid: 'u' } });
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ enabled: false });
  });

  it('returns the graph, verified, and caches it briefly', async () => {
    const f = okFetch();
    let t = 0;
    const call = mount(ENV, f, () => t);
    const first = await call({ user: { uid: 'u' } });
    expect(first.body.enabled).toBe(true);
    expect(first.body.cached).toBe(false);
    expect(first.body.graph.conflicts[0].ref).toBe('shared/build_cmd');
    expect(first.body.graph.chain).toMatchObject({
      continuous: true,
      digestsChecked: 12,
      digestMismatches: [],
    });
    t = 5_000;
    expect((await call({ user: { uid: 'u' } })).body.cached).toBe(true);
    t = 60_000;
    expect((await call({ user: { uid: 'u' } })).body.cached).toBe(false);
    expect(f).toHaveBeenCalledTimes(2);
    const url = String((f as any).mock.calls[0][0]);
    expect(url).toContain('https://x.supabase.co/rest/v1/unisync_events?');
    expect((f as any).mock.calls[0][1].headers).toEqual({ apikey: 'k', Authorization: 'Bearer k' });
  });

  it('reports upstream failures as 502 without throwing', async () => {
    const bad = vi.fn(async () => new Response('nope', { status: 401 })) as unknown as typeof fetch;
    const res = await mount(ENV, bad)({ user: { uid: 'u' } });
    expect(res.statusCode).toBe(502);
    expect(res.body.error).toContain('HTTP 401');
  });
});

describe('fetchLedgerRows', () => {
  it('pages until a short page', async () => {
    const page = Array.from({ length: 1000 }, (_, i) => ({ seq: i }));
    const f = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(page)))
      .mockResolvedValueOnce(
        new Response(JSON.stringify([{ seq: 1000 }])),
      ) as unknown as typeof fetch;
    const out = await fetchLedgerRows('https://x', 'k', f);
    expect(out).toHaveLength(1001);
    expect(String((f as any).mock.calls[1][0])).toContain('seq=gte.1000');
  });

  it('rejects a non-array body', async () => {
    const f = vi.fn(async () => new Response('{}')) as unknown as typeof fetch;
    await expect(fetchLedgerRows('https://x', 'k', f)).rejects.toThrow('non-array');
  });
});
