/**
 * GET /api/unisync/memory: the shared UniSync memory as a graph, read-only.
 *
 * Configuration (server-side only, never sent to the browser):
 *   UNISYNC_SUPABASE_URL  https://<ref>.supabase.co
 *   UNISYNC_SUPABASE_KEY  a key that can SELECT unisync_events (the ledger has RLS with no anon policy)
 * Graceful degradation: unconfigured -> 200 {enabled:false}; upstream failure -> 502 with a reason.
 * Access: a signed-in user (req.user from authenticateRequest) or a loopback request.
 */
import { createHash } from 'node:crypto';
import { buildMemoryGraph, type MemoryGraph, parseEnvelopes } from './unisync-memory.js';

const PAGE = 1000;
const CACHE_MS = 15_000;

export interface UniSyncRouteOptions {
  fetchImpl?: typeof fetch;
  env?: Record<string, string | undefined>;
  now?: () => number;
}

type Handler = (req: any, res: any) => Promise<void> | void;
interface RouterLike {
  get: (path: string, handler: Handler) => unknown;
}

const sha256 = (text: string): string => createHash('sha256').update(text, 'utf8').digest('hex');

function isLoopback(req: any): boolean {
  const ip = String(req.ip ?? req.socket?.remoteAddress ?? '');
  return ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';
}

export async function fetchLedgerRows(
  url: string,
  key: string,
  fetchImpl: typeof fetch,
): Promise<unknown[]> {
  const rows: unknown[] = [];
  for (;;) {
    const q = new URLSearchParams({
      select: 'v,seq,sender,kind,task_id,body,prev,digest,ts',
      seq: `gte.${rows.length}`,
      order: 'seq.asc',
      limit: String(PAGE),
    });
    const resp = await fetchImpl(`${url.replace(/\/+$/, '')}/rest/v1/unisync_events?${q}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    if (!resp.ok) throw new Error(`Supabase returned HTTP ${resp.status}`);
    const page = await resp.json();
    if (!Array.isArray(page)) throw new Error('Supabase returned a non-array body');
    rows.push(...page);
    if (page.length < PAGE) return rows;
  }
}

export function registerUniSyncMemoryRoute(
  app: RouterLike,
  options: UniSyncRouteOptions = {},
): void {
  const env = options.env ?? process.env;
  const fetchImpl = options.fetchImpl ?? fetch;
  const now = options.now ?? Date.now;
  let cache: { at: number; graph: MemoryGraph } | null = null;

  app.get('/api/unisync/memory', async (req, res) => {
    if (!req.user && !isLoopback(req)) {
      res.status(401).json({ error: 'Sign in to view shared memory' });
      return;
    }
    const url = env.UNISYNC_SUPABASE_URL;
    const key = env.UNISYNC_SUPABASE_KEY;
    if (!url || !key) {
      res.json({
        enabled: false,
        reason: 'Set UNISYNC_SUPABASE_URL and UNISYNC_SUPABASE_KEY on the server',
      });
      return;
    }
    if (cache && now() - cache.at < CACHE_MS) {
      res.json({ enabled: true, cached: true, graph: cache.graph });
      return;
    }
    try {
      const entries = parseEnvelopes(await fetchLedgerRows(url, key, fetchImpl));
      const graph = buildMemoryGraph(entries, { sha256 });
      cache = { at: now(), graph };
      res.json({ enabled: true, cached: false, graph });
    } catch (err) {
      res
        .status(502)
        .json({ enabled: true, error: err instanceof Error ? err.message : String(err) });
    }
  });
}
