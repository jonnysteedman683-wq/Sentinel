
import { Timestamp } from 'firebase-admin/firestore';
import { MemoryNode } from '../src/types';
import { applyDecay, getStateTransition, computeDecayedStrength } from '../src/lib/memory-lifecycle';

function createMockMemory(state: MemoryNode['state'], strength: number, lastAccessedHoursAgo: number): MemoryNode {
  const lastAccessed = Timestamp.fromDate(new Date(Date.now() - lastAccessedHoursAgo * 60 * 60 * 1000));
  return {
    id: 'test-mem-' + Math.random(),
    content: 'test content',
    summary: 'test summary',
    embedding: [0.1, 0.2],
    tags: [],
    strength,
    state,
    createdAt: Timestamp.now(),
    lastAccessed,
    accessCount: 0,
    decayRate: 0.005,
    linkedMemories: [],
    userId: 'test-user',
  };
}

function runTests() {
  console.log('--- Starting Memory Lifecycle Debug Tests ---');

  // 1. Test Decay Formula
  console.log('\nTesting Decay Formula...');
  const mem = createMockMemory('shortTerm', 0.5, 24); // 24 hours ago
  const decayedStrength = computeDecayedStrength(mem, new Date());
  console.log(`Initial Strength: 0.5, After 24h: ${decayedStrength.toFixed(4)}`);
  if (decayedStrength < 0.5) console.log('PASS: Decay occurred.');
  else console.log('FAIL: No decay.');

  // 2. Test State Transitions
  console.log('\nTesting State Transitions...');
  
  // Transition: ephemeral -> shortTerm
  const ephMem = createMockMemory('ephemeral', 0.7, 0);
  const transEph = getStateTransition(ephMem);
  console.log(`Ephemeral (0.7) -> ${transEph.state}`);
  if (transEph.state === 'shortTerm') console.log('PASS: Ephemeral -> ShortTerm');
  else console.log('FAIL: Transition failed.');

  // Transition: ephemeral -> forgotten
  const forgetMem = createMockMemory('ephemeral', 0.01, 0);
  const transForget = getStateTransition(forgetMem);
  console.log(`Ephemeral (0.01) -> ${transForget.state}`);
  if (transForget.state === 'forgotten') console.log('PASS: Ephemeral -> Forgotten');
  else console.log('FAIL: Transition failed.');

  // 3. Test Complex Scenario: Decay + Transition
  console.log('\nTesting Decay + Transition...');
  const shortMem = createMockMemory('shortTerm', 0.15, 48); // High decay
  const decayedShort = applyDecay(shortMem);
  const transitionedShort = getStateTransition(decayedShort);
  console.log(`ShortTerm (0.15, 48h decay) -> Strength: ${decayedShort.strength.toFixed(4)}, State: ${transitionedShort.state}`);
  if (transitionedShort.state === 'forgotten') console.log('PASS: Decayed into Forgotten');
  else console.log('FAIL: Transition failed.');

  console.log('\n--- Tests Complete ---');
}

runTests();
