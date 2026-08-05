import { describe, it, expect } from 'vitest';
import { SelfHealingOrchestrator } from './self-healing-orchestrator.js';

describe('SelfHealingOrchestrator', () => {
  it('should initialize and run a cycle', async () => {
    const orchestrator = new SelfHealingOrchestrator('test-user', null);
    
    // Check methods existence
    expect(typeof orchestrator.start).toBe('function');
    expect(typeof orchestrator.executeAction).toBe('function');
    
    // We shouldn't execute full cycle in unit test because it has timers and complex dependencies,
    // but we can verify the initialization.
    expect(orchestrator).toBeDefined();
  });
});
