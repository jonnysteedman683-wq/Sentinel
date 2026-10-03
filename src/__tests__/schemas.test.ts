import { describe, it, expect } from 'vitest';
import {
  ChatRequestSchema,
  KnowledgeNodeSchema,
  MemoryNodeSchema,
} from '../schemas.js';

describe('ChatRequestSchema', () => {
  const valid = {
    history: [{ role: 'user', content: 'hi' }],
    message: 'hello',
  };

  it('accepts a minimal valid request', () => {
    expect(ChatRequestSchema.safeParse(valid).success).toBe(true);
  });

  it('accepts optional fields with valid enums', () => {
    const res = ChatRequestSchema.safeParse({ ...valid, depth: 'Deep Reasoning', sway: 0.5 });
    expect(res.success).toBe(true);
  });

  it('rejects a missing message', () => {
    const { message, ...noMessage } = valid;
    expect(ChatRequestSchema.safeParse(noMessage).success).toBe(false);
  });

  it('rejects an invalid history role', () => {
    const res = ChatRequestSchema.safeParse({
      ...valid,
      history: [{ role: 'robot', content: 'x' }],
    });
    expect(res.success).toBe(false);
  });

  it('rejects an invalid depth enum', () => {
    expect(ChatRequestSchema.safeParse({ ...valid, depth: 'Instant' }).success).toBe(false);
  });
});

describe('MemoryNodeSchema', () => {
  const validMemory = {
    id: 'm1',
    content: 'a memory',
    embedding: [0.1, 0.2],
    tags: ['x'],
    strength: 0.8,
    state: 'shortTerm',
    createdAt: Date.now(),
    lastAccessed: Date.now(),
    accessCount: 3,
    decayRate: 0.01,
  };

  it('accepts a valid memory node', () => {
    expect(MemoryNodeSchema.safeParse(validMemory).success).toBe(true);
  });

  it('rejects an unknown state', () => {
    expect(MemoryNodeSchema.safeParse({ ...validMemory, state: 'frozen' }).success).toBe(false);
  });

  it('rejects a non-numeric strength', () => {
    expect(MemoryNodeSchema.safeParse({ ...validMemory, strength: 'high' }).success).toBe(false);
  });
});

describe('KnowledgeNodeSchema', () => {
  it('accepts a node without optional tags/metadata', () => {
    const res = KnowledgeNodeSchema.safeParse({
      id: 'k1',
      content: 'fact',
      embedding: [0.5],
    });
    expect(res.success).toBe(true);
  });

  it('rejects a missing embedding', () => {
    expect(KnowledgeNodeSchema.safeParse({ id: 'k1', content: 'fact' }).success).toBe(false);
  });
});
