import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Avoid Firebase initialisation when importing the module; the pure helpers and
// the local embedding fallback under test never touch Firestore.
vi.mock('../firestore-shim.js', () => ({
  dbShim: { collection: () => ({ add: async () => {} }) },
  FieldValue: { serverTimestamp: () => 0 },
}));

import { FallbackGenAI, generateLocalEmbedding, schemaToInstruction } from '../ai-service.js';

describe('schemaToInstruction', () => {
  it('returns an empty string for a nullish schema', () => {
    expect(schemaToInstruction(null)).toBe('');
    expect(schemaToInstruction(undefined)).toBe('');
  });

  it('renders flat properties as string fields inside a json block', () => {
    const out = schemaToInstruction({
      properties: { name: { type: 'string' }, age: { type: 'number' } },
    });
    expect(out).toContain('```json');
    expect(out).toContain('"name": "string"');
    expect(out).toContain('"age": "string"');
  });

  it('renders array properties as a string array', () => {
    const out = schemaToInstruction({ properties: { tags: { type: 'array' } } });
    expect(out).toContain('"tags": ["string"]');
  });

  it('expands nested object properties', () => {
    const out = schemaToInstruction({
      properties: { profile: { type: 'object', properties: { bio: { type: 'string' } } } },
    });
    expect(out).toContain('"profile": {');
    expect(out).toContain('"bio": "string"');
  });
});

describe('generateLocalEmbedding', () => {
  it('produces a 128-dimensional vector', () => {
    expect(generateLocalEmbedding('hello world')).toHaveLength(128);
  });

  it('is deterministic for the same input', () => {
    expect(generateLocalEmbedding('quantum brain')).toEqual(
      generateLocalEmbedding('quantum brain'),
    );
  });

  it('returns a unit-length vector for non-empty input', () => {
    const v = generateLocalEmbedding('the neural interface hums');
    const magnitude = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
    expect(magnitude).toBeCloseTo(1, 6);
  });

  it('returns an all-zero vector for the empty string', () => {
    const v = generateLocalEmbedding('');
    expect(v).toHaveLength(128);
    expect(v.every((x) => x === 0)).toBe(true);
  });

  it('produces different vectors for clearly different inputs', () => {
    expect(generateLocalEmbedding('alpha beta')).not.toEqual(generateLocalEmbedding('gamma delta'));
  });
});

describe('FallbackGenAI.embedContent (local fallback)', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.GEMINI_API_KEY; // force the local embedding path
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('falls back to a local embedding when no Gemini key is configured', async () => {
    const ai = new FallbackGenAI();
    const res = (await ai.models.embedContent({ contents: 'offline please' })) as any;
    expect(res.embeddings[0].values).toHaveLength(128);
    expect(res.embeddings[0].values).toEqual(generateLocalEmbedding('offline please'));
  });

  it('stringifies non-string contents before embedding', async () => {
    const ai = new FallbackGenAI();
    const res = (await ai.models.embedContent({ contents: { a: 1 } })) as any;
    expect(res.embeddings[0].values).toEqual(generateLocalEmbedding(JSON.stringify({ a: 1 })));
  });
});
