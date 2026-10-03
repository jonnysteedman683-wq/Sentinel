import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('ai-client', () => {
  const originalEnv = process.env;

  beforeEach(async () => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should instantiate GoogleGenAI when GEMINI_API_KEY is present', async () => {
    process.env.GEMINI_API_KEY = 'fake-key';
    const { getAi } = await import('../ai-client.js');
    const ai = getAi();
    expect(ai.constructor.name).toBe('GoogleGenAI');
  });

  it('should instantiate FallbackGenAI when GEMINI_API_KEY is absent', async () => {
    delete process.env.GEMINI_API_KEY;
    const { getAi } = await import('../ai-client.js');
    const ai = getAi();
    expect(ai.constructor.name).toBe('FallbackGenAI');
  });

  it('should reuse the same client instance on multiple calls', async () => {
    delete process.env.GEMINI_API_KEY;
    const { getAi } = await import('../ai-client.js');
    const ai1 = getAi();
    const ai2 = getAi();
    expect(ai1).toBe(ai2);
  });
});
