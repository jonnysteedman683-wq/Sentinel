/**
 * UniSync shared memory, read-only (LinX active memory, stage 2).
 *
 * The UniSync ledger (Supabase `unisync_events`, written by Jonny's agents through LinX and
 * Lestinxor) is the record of truth for shared memory. Sentinel only reads it and renders it as a
 * graph. This module is pure: no I/O, no Firebase, no LLM. Rules mirror `linx memory check`:
 *   conflicts  - two or more agents disagree on a key within its last CONFLICT_WINDOW writes
 *   stale      - a key's last write is `staleAfter` or more entries behind the ledger head
 *   duplicates - keys in one scope holding the identical value
 *   links      - a value naming another key (`scope/key`, or a bare key in the same scope)
 * Chain checks: `seq` must run 0..n-1 and each `prev` must equal the previous `digest`. Digests are
 * recomputed with a Python-compatible canonical JSON; integral floats written by Python (e.g. 1.0)
 * cannot be told apart from integers after JSON parsing, so a digest mismatch is reported, not
 * treated as proof of tampering. `linx selftest` is the authoritative verifier.
 */

export const GENESIS = '0'.repeat(64);
export const CONFLICT_WINDOW = 5;
export const SUMMARY_SCOPE = 'linx/memory';

export interface UniSyncEnvelope {
  v: string;
  seq: number;
  sender: string;
  kind: string;
  task_id: string;
  body: Record<string, unknown>;
  prev: string;
  digest: string;
  ts: number;
}

export interface MemoryWrite {
  seq: number;
  sender: string;
  value: unknown;
  ts: number;
}

export interface MemoryFact {
  ref: string;
  scope: string;
  key: string;
  history: MemoryWrite[];
  writers: string[];
  current: MemoryWrite;
}

export interface MemoryConflict {
  ref: string;
  values: Record<string, unknown>;
}

export interface ChainReport {
  entries: number;
  continuous: boolean;
  /** First seq where continuity breaks, or null. */
  brokenAt: number | null;
  digestsChecked: number;
  digestMismatches: number[];
}

export type MemoryNodeKind = 'fact' | 'agent';

export interface MemoryGraphNode {
  id: string;
  kind: MemoryNodeKind;
  label: string;
  scope?: string;
  conflict?: boolean;
  stale?: boolean;
  writes?: number;
  value?: unknown;
  lastWriter?: string;
  lastSeq?: number;
}

export type MemoryEdgeKind = 'wrote' | 'links' | 'duplicate';

export interface MemoryGraphEdge {
  source: string;
  target: string;
  kind: MemoryEdgeKind;
}

export interface MemoryGraph {
  head: number;
  facts: number;
  nodes: MemoryGraphNode[];
  edges: MemoryGraphEdge[];
  conflicts: MemoryConflict[];
  stale: string[];
  duplicates: string[][];
  links: Record<string, string[]>;
  chain: ChainReport;
}

// ── canonical JSON compatible with Python json.dumps(sort_keys=True, separators=(",", ":")) ──

function pyFloat(x: number): string {
  const [mant, expStr] = x.toExponential().split('e');
  const exp = Number(expStr);
  const neg = mant.startsWith('-');
  const digits = mant.replace('-', '').replace('.', '');
  let out: string;
  if (exp >= -4 && exp < 16) {
    if (exp >= 0) {
      const intPart = digits.slice(0, exp + 1).padEnd(exp + 1, '0');
      const frac = digits.slice(exp + 1);
      out = `${intPart}.${frac || '0'}`;
    } else {
      out = `0.${'0'.repeat(-exp - 1)}${digits}`;
    }
  } else {
    const m = digits.length > 1 ? `${digits[0]}.${digits.slice(1)}` : digits;
    const e = Math.abs(exp).toString().padStart(2, '0');
    out = `${m}e${exp < 0 ? '-' : '+'}${e}`;
  }
  return neg ? `-${out}` : out;
}

function pyString(s: string): string {
  let out = '"';
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    const ch = s[i];
    if (ch === '"') out += '\\"';
    else if (ch === '\\') out += '\\\\';
    else if (ch === '\n') out += '\\n';
    else if (ch === '\r') out += '\\r';
    else if (ch === '\t') out += '\\t';
    else if (ch === '\b') out += '\\b';
    else if (ch === '\f') out += '\\f';
    else if (c < 0x20 || c > 0x7f) out += `\\u${c.toString(16).padStart(4, '0')}`;
    else out += ch;
  }
  return `${out}"`;
}

export function canonicalJson(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return value > 0 ? 'Infinity' : value < 0 ? '-Infinity' : 'NaN';
    // Integers at or above 1e16 are past JS's exact range (2^53), so they can only have come from a
    // Python float such as 1.5e+17; Python prints those in exponent form.
    return Number.isInteger(value) && Math.abs(value) < 1e16 ? String(value) : pyFloat(value);
  }
  if (typeof value === 'string') return pyString(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj).sort();
    return `{${keys.map((k) => `${pyString(k)}:${canonicalJson(obj[k])}`).join(',')}}`;
  }
  return pyString(String(value));
}

export type Sha256 = (text: string) => string;

export function envelopeDigest(e: UniSyncEnvelope, sha256: Sha256): string {
  const payload = {
    v: e.v,
    seq: e.seq,
    sender: e.sender,
    kind: e.kind,
    task_id: e.task_id,
    body: e.body,
    prev: e.prev,
  };
  return sha256(canonicalJson(payload));
}

// ── parsing and chain ────────────────────────────────────────────────────────

export function parseEnvelopes(rows: unknown): UniSyncEnvelope[] {
  if (!Array.isArray(rows)) throw new Error('UniSync rows must be an array');
  return rows
    .map((raw, i) => {
      const r = raw as Partial<UniSyncEnvelope>;
      if (
        typeof r?.seq !== 'number' ||
        typeof r.sender !== 'string' ||
        typeof r.kind !== 'string' ||
        typeof r.prev !== 'string' ||
        typeof r.digest !== 'string' ||
        typeof r.body !== 'object' ||
        r.body === null
      ) {
        throw new Error(`UniSync row ${i} is malformed`);
      }
      return {
        v: typeof r.v === 'string' ? r.v : 'unisync/1',
        seq: r.seq,
        sender: r.sender,
        kind: r.kind,
        task_id: typeof r.task_id === 'string' ? r.task_id : '',
        body: r.body as Record<string, unknown>,
        prev: r.prev,
        digest: r.digest,
        ts: typeof r.ts === 'number' ? r.ts : 0,
      };
    })
    .sort((a, b) => a.seq - b.seq);
}

export function checkChain(entries: UniSyncEnvelope[], sha256?: Sha256): ChainReport {
  let prev = GENESIS;
  let brokenAt: number | null = null;
  const mismatches: number[] = [];
  entries.forEach((e, i) => {
    if (brokenAt === null && (e.seq !== i || e.prev !== prev)) brokenAt = e.seq;
    if (sha256 && envelopeDigest(e, sha256) !== e.digest) mismatches.push(e.seq);
    prev = e.digest;
  });
  return {
    entries: entries.length,
    continuous: brokenAt === null,
    brokenAt,
    digestsChecked: sha256 ? entries.length : 0,
    digestMismatches: mismatches,
  };
}

// ── memory ───────────────────────────────────────────────────────────────────

export function indexMemory(entries: UniSyncEnvelope[]): Map<string, MemoryFact> {
  const facts = new Map<string, MemoryFact>();
  for (const e of entries) {
    if (e.kind !== 'memory.write' || typeof e.body.key !== 'string') continue;
    const scope = typeof e.body.scope === 'string' ? e.body.scope : 'shared';
    const ref = `${scope}/${e.body.key}`;
    const write: MemoryWrite = { seq: e.seq, sender: e.sender, value: e.body.value, ts: e.ts };
    const fact = facts.get(ref);
    if (fact) {
      fact.history.push(write);
      fact.current = write;
      if (!fact.writers.includes(e.sender)) fact.writers = [...fact.writers, e.sender].sort();
    } else {
      facts.set(ref, {
        ref,
        scope,
        key: e.body.key,
        history: [write],
        writers: [e.sender],
        current: write,
      });
    }
  }
  return facts;
}

function strings(value: unknown, out: string[] = []): string[] {
  if (typeof value === 'string') {
    out.push(value);
  } else if (Array.isArray(value)) {
    for (const v of value) strings(v, out);
  } else if (value && typeof value === 'object') {
    for (const v of Object.values(value)) strings(v, out);
  }
  return out;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function buildMemoryGraph(
  entries: UniSyncEnvelope[],
  options: { staleAfter?: number; sha256?: Sha256 } = {},
): MemoryGraph {
  const staleAfter = options.staleAfter ?? 500;
  const head = entries.length ? entries[entries.length - 1].seq : -1;
  const facts = [...indexMemory(entries).values()]
    .filter((f) => f.scope !== SUMMARY_SCOPE)
    .sort((a, b) => (a.ref < b.ref ? -1 : a.ref > b.ref ? 1 : 0));
  const refs = facts.map((f) => f.ref);

  const conflicts: MemoryConflict[] = [];
  for (const f of facts) {
    const latest: Record<string, unknown> = {};
    for (const w of f.history.slice(-CONFLICT_WINDOW)) latest[w.sender] = w.value;
    const distinct = new Set(Object.values(latest).map(canonicalJson));
    if (Object.keys(latest).length > 1 && distinct.size > 1) {
      const sorted: Record<string, unknown> = {};
      for (const k of Object.keys(latest).sort()) sorted[k] = latest[k];
      conflicts.push({ ref: f.ref, values: sorted });
    }
  }

  const stale = facts.filter((f) => head - f.current.seq >= staleAfter).map((f) => f.ref);

  const groups = new Map<string, string[]>();
  for (const f of facts) {
    const k = `${f.scope}\u0000${canonicalJson(f.current.value)}`;
    groups.set(k, [...(groups.get(k) ?? []), f.ref]);
  }
  const duplicates = [...groups.values()]
    .filter((g) => g.length > 1)
    .map((g) => [...g].sort())
    .sort((a, b) => a[0].localeCompare(b[0]));

  const links: Record<string, string[]> = {};
  for (const f of facts) {
    const texts = strings(f.current.value);
    const found = new Set<string>();
    for (const of of facts) {
      if (of.ref === f.ref) continue;
      const full = new RegExp(`(?<![\\w/])${escapeRe(of.ref)}(?![\\w/])`);
      const bare = new RegExp(`(?<![\\w/])${escapeRe(of.key)}(?![\\w/])`);
      if (texts.some((t) => full.test(t) || (of.scope === f.scope && bare.test(t))))
        found.add(of.ref);
    }
    if (found.size) links[f.ref] = [...found].sort();
  }

  const conflicted = new Set(conflicts.map((c) => c.ref));
  const staleSet = new Set(stale);
  const nodes: MemoryGraphNode[] = facts.map((f) => ({
    id: f.ref,
    kind: 'fact',
    label: f.key,
    scope: f.scope,
    conflict: conflicted.has(f.ref),
    stale: staleSet.has(f.ref),
    writes: f.history.length,
    value: f.current.value,
    lastWriter: f.current.sender,
    lastSeq: f.current.seq,
  }));
  const agents = [...new Set(facts.flatMap((f) => f.writers))].sort();
  nodes.push(
    ...agents.map((a): MemoryGraphNode => ({ id: `agent:${a}`, kind: 'agent', label: a })),
  );

  const edges: MemoryGraphEdge[] = [];
  for (const f of facts) {
    for (const w of f.writers) edges.push({ source: `agent:${w}`, target: f.ref, kind: 'wrote' });
    for (const t of links[f.ref] ?? []) edges.push({ source: f.ref, target: t, kind: 'links' });
  }
  for (const g of duplicates) {
    for (const other of g.slice(1)) edges.push({ source: g[0], target: other, kind: 'duplicate' });
  }

  return {
    head,
    facts: refs.length,
    nodes,
    edges,
    conflicts,
    stale,
    duplicates,
    links,
    chain: checkChain(entries, options.sha256),
  };
}
