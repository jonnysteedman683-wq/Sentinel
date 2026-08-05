// FILE: src/lib/rl-agent.test.ts — [Test contract for Delayed Gradient Pipeline and CuriousAgent credit assignment]
import { describe, it, expect, vi } from 'vitest';
import { CuriousAgentCore as CuriousAgent } from './rl-agent-core.js';

// Mock the firebase module to prevent network calls during testing
vi.mock('../firebase.js', () => {
  return {
    db: {},
    doc: vi.fn(() => ({ id: 'mock-doc' })),
    getDoc: vi.fn(() => Promise.resolve({ exists: () => false, data: () => null })),
    setDoc: vi.fn(() => Promise.resolve()),
    deleteDoc: vi.fn(() => Promise.resolve()),
    collection: vi.fn(() => ({})),
    addDoc: vi.fn(() => Promise.resolve({ id: 'mock-add-doc' }))
  };
});

describe('CuriousAgent Delayed Gradient Pipeline', () => {
  it('should successfully register a delayed trajectory locally', () => {
    const agent = new CuriousAgent(4, 7, 'test-user-999');
    const state = [1, 2, 1, 0];
    const nextState = [1, 2, 1, 1];
    
    agent.registerDelayedTrajectory('test-trajectory-id', state, 3, nextState, 'nudge');
    
    const pending = agent.pendingTrajectories['test-trajectory-id'];
    expect(pending).toBeDefined();
    expect(pending.id).toBe('test-trajectory-id');
    expect(pending.state).toEqual(state);
    expect(pending.action).toBe(3);
    expect(pending.nextState).toEqual(nextState);
    expect(pending.type).toBe('nudge');
  });

  it('should apply credit assignment and resolve delayed rewards from local trajectory', async () => {
    const agent = new CuriousAgent(4, 7, 'test-user-999');
    const state = [2, 5, 1, 0];
    const nextState = [2, 5, 1, 1];
    
    agent.registerDelayedTrajectory('test-insight-123', state, 5, nextState, 'insight');
    expect(agent.experienceBuffer.length).toBe(0);

    // Act: apply delayed accept reward (value = 'accept' which translates to 1.0)
    await agent.applyDelayedReward('test-insight-123', 'accept');

    // Assert: experience should be added to the buffer
    expect(agent.experienceBuffer.length).toBe(1);
    expect(agent.experienceBuffer[0].state).toEqual(state);
    expect(agent.experienceBuffer[0].action).toBe(5);
    expect(agent.experienceBuffer[0].reward).toBe(1.0);
    expect(agent.experienceBuffer[0].nextState).toEqual(nextState);

    // Trajectory should be deleted from pending map
    expect(agent.pendingTrajectories['test-insight-123']).toBeUndefined();
  });

  it('should fallback to default reward mapping if trajectory is not found', async () => {
    const agent = new CuriousAgent(4, 7, 'test-user-999');
    expect(agent.experienceBuffer.length).toBe(0);

    // Act: apply delayed reward for an untracked/expired ID
    await agent.applyDelayedReward('expired-trajectory-id', 'accept');

    // Assert: fallback to current/last state transition (experience added)
    expect(agent.experienceBuffer.length).toBe(1);
    expect(agent.experienceBuffer[0].reward).toBe(1.0);
  });
});

describe('Active Inference Action Pruning', () => {
  it('should evaluate and identify proactive actions that need pruning', async () => {
    const agent = new CuriousAgent(4, 7, 'test-user-999');
    const state = [0.1, 0.2, 0.3, 0.4];

    // Evaluate standard non-proactive action (e.g. CHANGE_DEPTH = 1) -> should never be pruned
    const resDepth = await agent.aiPlanner.shouldPruneAction(state, 1);
    expect(resDepth.pruned).toBe(false);

    // Evaluate standard proactive action (e.g. NUDGE = 3).
    // The EFE computation evaluates sequence and returns a step EFE.
    // Let's ensure shouldPruneAction correctly returns efe, threshold, and pruned flag.
    const resNudge = await agent.aiPlanner.shouldPruneAction(state, 3);
    expect(resNudge).toHaveProperty('pruned');
    expect(resNudge).toHaveProperty('efe');
    expect(resNudge).toHaveProperty('threshold');
    expect(resNudge.threshold).toBe(5.0);
  });

  it('should fallback to IDLE action if proposed action is pruned', async () => {
    const agent = new CuriousAgent(4, 7, 'test-user-999');
    const state = [0.1, 0.2, 0.3, 0.4];

    // Spy on shouldPruneAction to force a prune outcome
    vi.spyOn(agent.aiPlanner, 'shouldPruneAction').mockResolvedValue({
      pruned: true,
      efe: 15.6,
      threshold: 5.0
    });

    // Force selectAction to pick the action that will be pruned
    vi.spyOn(agent.aiPlanner, 'plan').mockResolvedValue({
      type: 'action',
      index: 3, // Nudge action
      efe: 15.6
    });

    const decision = await agent.aiPlanner.selectAction(state);
    
    // Assert that the selection was fallback-redirected to IDLE (index: 0)
    expect(decision.index).toBe(0);
    expect(decision.prunedAction).toBe(3);
    expect(decision.efeBeforePruning).toBe(15.6);
  });
});
