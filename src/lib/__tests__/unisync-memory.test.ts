import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  buildMemoryGraph,
  CONFLICT_WINDOW,
  canonicalJson,
  checkChain,
  indexMemory,
  parseEnvelopes,
  type UniSyncEnvelope,
} from '../unisync-memory.js';

// Written by Lestinxor's Python reference implementation (see LinX tests): the digests are the truth.
const FIXTURE = path.join(__dirname, 'fixtures', 'unisync-ledger.jsonl');
const rows = readFileSync(FIXTURE, 'utf8')
  .trim()
  .split('\n')
  .map((l) => JSON.parse(l));
const sha256 = (t: string) => createHash('sha256').update(t, 'utf8').digest('hex');

function entries(): UniSyncEnvelope[] {
  return parseEnvelopes(rows);
}

describe('canonicalJson matches Python json.dumps(sort_keys, compact)', () => {
  it('handles strings, floats and ordering like Python', () => {
    expect(canonicalJson({ b: 1, a: [true, null, 'x'] })).toBe('{"a":[true,null,"x"],"b":1}');
    expect(canonicalJson('héllo ✓ "q"\n\t')).toBe('"h\\u00e9llo \\u2713 \\"q\\"\\n\\t"');
    expect(canonicalJson('\u007f')).toBe('"\u007f"');
    expect(canonicalJson(0.75)).toBe('0.75');
    expect(canonicalJson(1e-7)).toBe('1e-07');
    expect(canonicalJson(1.5e17)).toBe('1.5e+17');
    expect(canonicalJson(0.0001)).toBe('0.0001');
    expect(canonicalJson(123.5)).toBe('123.5');
    expect(canonicalJson(-2.5e-5)).toBe('-2.5e-05');
  });
});

describe('chain', () => {
  it('recomputes every Python digest exactly and finds the chain continuous', () => {
    const report = checkChain(entries(), sha256);
    expect(report).toEqual({
      entries: 12,
      continuous: true,
      brokenAt: null,
      digestsChecked: 12,
      digestMismatches: [],
    });
  });

  it('flags a removed entry and an edited body', () => {
    const gap = entries().filter((e) => e.seq !== 3);
    expect(checkChain(gap).brokenAt).toBe(4);
    const edited = entries();
    edited[2] = { ...edited[2], body: { ...edited[2].body, value: 'tampered' } };
    const r = checkChain(edited, sha256);
    expect(r.continuous).toBe(true);
    expect(r.digestMismatches).toEqual([2]);
  });

  it('rejects malformed rows', () => {
    expect(() => parseEnvelopes({})).toThrow('array');
    expect(() => parseEnvelopes([{ seq: 0 }])).toThrow('row 0');
  });
});

describe('memory graph (same rules as `linx memory check`)', () => {
  it('indexes full history per scope/key', () => {
    const build = indexMemory(entries()).get('shared/build_cmd');
    if (!build) throw new Error('missing fact');
    expect(build.history.map((w) => w.sender)).toEqual(['sebastian', 'horizontal']);
    expect(build.writers).toEqual(['horizontal', 'sebastian']);
  });

  it('finds conflicts, stale, duplicates and links', () => {
    const g = buildMemoryGraph(entries(), { staleAfter: 10, sha256 });
    expect(g.head).toBe(11);
    expect(g.conflicts).toEqual([
      {
        ref: 'shared/build_cmd',
        values: { horizontal: 'python -m compileall -q .', sebastian: 'python -m pytest' },
      },
    ]);
    expect(g.stale).toContain('shared/old_note');
    expect(g.duplicates).toEqual([['shared/model_a', 'shared/model_b']]);
    expect(g.links['shared/plan']).toEqual(['shared/goal', 'vortex/task/t-aaa']);
    expect(g.chain.digestMismatches).toEqual([]);
  });

  it('builds fact and agent nodes with typed edges', () => {
    const g = buildMemoryGraph(entries());
    const build = g.nodes.find((n) => n.id === 'shared/build_cmd');
    expect(build).toMatchObject({
      kind: 'fact',
      conflict: true,
      writes: 2,
      lastWriter: 'horizontal',
    });
    expect(g.nodes.filter((n) => n.kind === 'agent').map((n) => n.label)).toContain('vortex');
    expect(g.edges).toContainEqual({
      source: 'agent:sebastian',
      target: 'shared/build_cmd',
      kind: 'wrote',
    });
    expect(g.edges).toContainEqual({ source: 'shared/plan', target: 'shared/goal', kind: 'links' });
    expect(g.edges).toContainEqual({
      source: 'shared/model_a',
      target: 'shared/model_b',
      kind: 'duplicate',
    });
    expect(g.chain.digestsChecked).toBe(0);
  });

  it('ignores the linx/memory summary scope and old disagreement outside the window', () => {
    const base = entries();
    let seq = base.length;
    const extra = (
      sender: string,
      key: string,
      value: unknown,
      scope = 'shared',
    ): UniSyncEnvelope => ({
      v: 'unisync/1',
      seq: seq++,
      sender,
      kind: 'memory.write',
      task_id: '',
      body: { key, value, scope },
      prev: '',
      digest: '',
      ts: 0,
    });
    const more = [
      extra('coordinator-bot', 'consolidation', { goal: 1 }, 'linx/memory'),
      extra('horizontal', 'k', 'old'),
    ];
    for (let i = 0; i < CONFLICT_WINDOW; i++) more.push(extra('sebastian', 'k', 'new'));
    const g = buildMemoryGraph([...base, ...more]);
    expect(g.nodes.some((n) => n.id.startsWith('linx/memory'))).toBe(false);
    expect(g.conflicts.map((c) => c.ref)).toEqual(['shared/build_cmd']);
  });
});
