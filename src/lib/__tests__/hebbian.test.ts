import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// In-memory Firestore fake. hebbian.ts only exercises a small slice of the
// firestore-shim surface: collection().where().orderBy().get(), collection()
// .doc().get()/.set(), and batch().set()/.delete()/.commit(). Query
// constraints (where/orderBy/limit) are no-ops here — tests seed exactly the
// documents each collection should return, in the order they should appear.
// ---------------------------------------------------------------------------
vi.mock('../firestore-shim.js', () => {
  const docs = new Map<string, any>();

  class FakeDocRef {
    constructor(public path: string) {}
    get id() {
      const parts = this.path.split('/');
      return parts[parts.length - 1];
    }
    async get() {
      const data = docs.get(this.path);
      return { id: this.id, exists: data !== undefined, data: () => data, ref: this };
    }
    async set(data: any, options?: { merge?: boolean }) {
      if (options?.merge && docs.has(this.path)) {
        docs.set(this.path, { ...docs.get(this.path), ...data });
      } else {
        docs.set(this.path, data);
      }
    }
    async delete() {
      docs.delete(this.path);
    }
  }

  class FakeColRef {
    constructor(public path: string) {}
    where() {
      return this;
    }
    orderBy() {
      return this;
    }
    limit() {
      return this;
    }
    doc(id: string) {
      return new FakeDocRef(`${this.path}/${id}`);
    }
    async get() {
      const prefix = `${this.path}/`;
      const out: any[] = [];
      for (const [key, data] of docs) {
        if (key.startsWith(prefix) && !key.slice(prefix.length).includes('/')) {
          const ref = new FakeDocRef(key);
          out.push({ id: ref.id, exists: true, data: () => data, ref });
        }
      }
      return {
        empty: out.length === 0,
        size: out.length,
        docs: out,
        forEach: (cb: any) => out.forEach(cb),
      };
    }
  }

  class FakeBatch {
    private ops: Array<{ type: 'set' | 'delete'; ref: any; data?: any; options?: any }> = [];
    set(ref: any, data: any, options?: any) {
      this.ops.push({ type: 'set', ref, data, options });
      return this;
    }
    delete(ref: any) {
      this.ops.push({ type: 'delete', ref });
      return this;
    }
    async commit() {
      for (const op of this.ops) {
        if (op.type === 'set') await op.ref.set(op.data, op.options);
        else await op.ref.delete();
      }
    }
  }

  const dbShim = {
    docs, // exposed for seeding / assertions in tests
    collection: (path: string) => new FakeColRef(path),
    doc: (path: string) => new FakeDocRef(path),
    batch: () => new FakeBatch(),
  };

  return { dbShim };
});

vi.mock('../events.js', () => ({ publishEvent: vi.fn() }));
vi.mock('../ai-service.js', () => ({ callGeminiGenerate: vi.fn() }));

import { callGeminiGenerate } from '../ai-service.js';
import { publishEvent } from '../events.js';
import { dbShim } from '../firestore-shim.js';
import { neurogenesisPhase, pruneWeakEdges, updateHebbianTraces } from '../hebbian.js';

const store = dbShim as unknown as { docs: Map<string, any> };
const USER = 'u1';
const eventsPath = `users/${USER}/systemHealth/eventLog`;
const edgesPath = `users/${USER}/hebbianEdges`;
const memPath = `users/${USER}/memories`;

function seed(path: string, data: any) {
  store.docs.set(path, data);
}

function reinforceEvent(memoryId: string, timestamp: number) {
  return { eventType: 'MEMORY_REINFORCED', timestamp, payload: { memoryId } };
}

beforeEach(() => {
  store.docs.clear();
  vi.mocked(publishEvent).mockReset();
  vi.mocked(callGeminiGenerate).mockReset();
});

describe('hebbian', () => {
  describe('updateHebbianTraces', () => {
    it('creates an edge for two memories reinforced within the co-access window', async () => {
      const t0 = 1_700_000_000_000;
      seed(`${eventsPath}/e1`, reinforceEvent('a', t0));
      seed(`${eventsPath}/e2`, reinforceEvent('b', t0 + 60_000)); // 1 min later

      await updateHebbianTraces(USER);

      const edge = store.docs.get(`${edgesPath}/a_b`);
      expect(edge).toBeDefined();
      expect(edge.source).toBe('a');
      expect(edge.target).toBe('b');
      expect(edge.trace).toBeCloseTo(0.1, 6); // baseIncrement, no affective gain
      expect(vi.mocked(publishEvent)).toHaveBeenCalledWith(
        USER,
        'hebbian',
        'HEBBIAN_TRACES_UPDATED',
        { updatedCount: 1 },
      );
    });

    it('normalises the edge id regardless of reinforcement order', async () => {
      const t0 = 1_700_000_000_000;
      seed(`${eventsPath}/e1`, reinforceEvent('b', t0));
      seed(`${eventsPath}/e2`, reinforceEvent('a', t0 + 60_000));

      await updateHebbianTraces(USER);

      expect(store.docs.get(`${edgesPath}/a_b`)).toBeDefined();
      expect(store.docs.get(`${edgesPath}/b_a`)).toBeUndefined();
    });

    it('does not link memories reinforced outside the 5-minute window', async () => {
      const t0 = 1_700_000_000_000;
      seed(`${eventsPath}/e1`, reinforceEvent('a', t0));
      seed(`${eventsPath}/e2`, reinforceEvent('b', t0 + 6 * 60_000)); // 6 min later

      await updateHebbianTraces(USER);

      expect(store.docs.get(`${edgesPath}/a_b`)).toBeUndefined();
      expect(vi.mocked(publishEvent)).not.toHaveBeenCalled();
    });

    it('scales the trace increment by affective (arousal) gain', async () => {
      const t0 = 1_700_000_000_000;
      seed(`${eventsPath}/e1`, reinforceEvent('a', t0));
      seed(`${eventsPath}/e2`, reinforceEvent('b', t0 + 60_000));

      await updateHebbianTraces(USER, { v: 0, a: 1.0, d: 0 });

      // gain = 1 + clamp(1.0 * 0.7) = 1.7 => increment 0.17
      expect(store.docs.get(`${edgesPath}/a_b`).trace).toBeCloseTo(0.17, 6);
    });

    it('accumulates onto an existing edge and caps the trace at 1', async () => {
      const t0 = 1_700_000_000_000;
      seed(`${edgesPath}/a_b`, {
        id: 'a_b',
        source: 'a',
        target: 'b',
        trace: 0.95,
        lastCoaccess: t0 - 1,
      });
      seed(`${eventsPath}/e1`, reinforceEvent('a', t0));
      seed(`${eventsPath}/e2`, reinforceEvent('b', t0 + 60_000));

      await updateHebbianTraces(USER);

      expect(store.docs.get(`${edgesPath}/a_b`).trace).toBe(1);
    });
  });

  describe('pruneWeakEdges', () => {
    it('deletes edges whose decayed trace falls below the threshold and keeps the rest', async () => {
      const now = Date.now();
      // Stale, weak edge: ~1000h old => decays to ~0.
      seed(`${edgesPath}/weak`, {
        id: 'weak',
        source: 'a',
        target: 'b',
        trace: 0.1,
        lastCoaccess: now - 1000 * 60 * 60 * 1000,
      });
      // Fresh, strong edge: barely decays.
      seed(`${edgesPath}/strong`, {
        id: 'strong',
        source: 'c',
        target: 'd',
        trace: 0.9,
        lastCoaccess: now,
      });

      await pruneWeakEdges(USER, 0.1);

      expect(store.docs.get(`${edgesPath}/weak`)).toBeUndefined();
      const strong = store.docs.get(`${edgesPath}/strong`);
      expect(strong).toBeDefined();
      expect(strong.trace).toBeCloseTo(0.9, 3);
      expect(vi.mocked(publishEvent)).toHaveBeenCalledWith(USER, 'hebbian', 'WEAK_EDGES_PRUNED', {
        prunedCount: 1,
        threshold: 0.1,
      });
    });

    it('does not emit an event when nothing is pruned', async () => {
      seed(`${edgesPath}/strong`, {
        id: 'strong',
        source: 'c',
        target: 'd',
        trace: 0.9,
        lastCoaccess: Date.now(),
      });

      await pruneWeakEdges(USER, 0.1);

      expect(vi.mocked(publishEvent)).not.toHaveBeenCalled();
    });
  });

  describe('neurogenesisPhase', () => {
    const vadNeutral = { v: 0, a: 0, d: 0 };

    function seedMemory(id: string, embedding: number[], state = 'core') {
      seed(`${memPath}/${id}`, {
        content: `memory ${id}`,
        summary: '',
        embedding,
        tags: [],
        strength: 0.9,
        state,
        accessCount: 0,
        decayRate: 0.001,
        linkedMemories: [],
        userId: USER,
      });
    }

    function bridgeDocs() {
      const out: any[] = [];
      for (const [key, data] of store.docs) {
        if (
          key.startsWith(`${memPath}/`) &&
          Array.isArray(data.tags) &&
          data.tags.includes('bridge')
        ) {
          out.push(data);
        }
      }
      return out;
    }

    it('does nothing when fewer than two eligible memories exist', async () => {
      seedMemory('m1', [1, 0]);

      await neurogenesisPhase(USER, vadNeutral);

      expect(vi.mocked(callGeminiGenerate)).not.toHaveBeenCalled();
      expect(bridgeDocs()).toHaveLength(0);
    });

    it('creates a bridge between two unlinked, highly similar memories', async () => {
      vi.mocked(callGeminiGenerate).mockResolvedValue({
        candidates: [{ content: { parts: [{ text: 'a bridging insight' }] } }],
      } as any);
      seedMemory('m1', [1, 0]);
      seedMemory('m2', [1, 0]); // identical => cosine similarity 1

      await neurogenesisPhase(USER, vadNeutral);

      const bridges = bridgeDocs();
      expect(bridges).toHaveLength(1);
      expect(bridges[0].state).toBe('shortTerm');
      expect(bridges[0].content).toBe('a bridging insight');
      expect(bridges[0].linkedMemories).toEqual(['m1', 'm2']);
      expect(vi.mocked(publishEvent)).toHaveBeenCalledWith(
        USER,
        'hebbian',
        'NEUROGENESIS_BRIDGE_CREATED',
        expect.objectContaining({ sourceA: 'm1', sourceB: 'm2' }),
      );
    });

    it('does not bridge a pair that is already linked', async () => {
      seedMemory('m1', [1, 0]);
      seedMemory('m2', [1, 0]);
      seed(`${edgesPath}/m1_m2`, {
        id: 'm1_m2',
        source: 'm1',
        target: 'm2',
        trace: 0.5,
        lastCoaccess: Date.now(),
      });

      await neurogenesisPhase(USER, vadNeutral);

      expect(vi.mocked(callGeminiGenerate)).not.toHaveBeenCalled();
      expect(bridgeDocs()).toHaveLength(0);
    });

    it('lowers the similarity threshold as arousal/valence rise', async () => {
      vi.mocked(callGeminiGenerate).mockResolvedValue({
        candidates: [{ content: { parts: [{ text: 'bridge' }] } }],
      } as any);
      // cosine similarity of 0.8: below the 0.85 base threshold, above 0.79.
      seedMemory('m1', [1, 0]);
      seedMemory('m2', [0.8, 0.6]);

      // Neutral VAD keeps the 0.85 threshold -> no bridge.
      await neurogenesisPhase(USER, vadNeutral);
      expect(bridgeDocs()).toHaveLength(0);

      // High arousal lowers threshold to ~0.79 -> bridge is formed.
      await neurogenesisPhase(USER, { v: 0, a: 0.6, d: 0 });
      expect(bridgeDocs()).toHaveLength(1);
    });
  });
});
