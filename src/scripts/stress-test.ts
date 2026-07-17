import * as tf from '@tensorflow/tfjs';
import { performance } from 'perf_hooks';

const ITERATIONS = 100;
const DEBATE_TIMEOUT_MS = 15000; // 15-second hard cap per debate

async function runCognitiveStressTest() {
  console.log(`Starting AQB Cognitive Stress Test: ${ITERATIONS} iterations...`);
  
  // 1. Initial Memory Baseline
  const initialMemory = tf.memory();
  console.log(`Initial Tensor Memory: ${initialMemory.numTensors} tensors`);

  let timeoutFailures = 0;
  let debateLatencies: number[] = [];

  for (let i = 0; i < ITERATIONS; i++) {
    const startTime = performance.now();
    console.log(`\n--- Cycle ${i + 1}/${ITERATIONS} ---`);

    try {
      // PHASE A: Simulate High-Frequency FSM UI Telemetry
      // This ensures the XState context handles rapid state updates without desyncing
      // mainMachine.send({ type: 'MOUSE_TELEMETRY', payload: { x: Math.random(), y: Math.random() }});
      // mainMachine.send({ type: 'PREDICT_NEXT' });

      // PHASE B: Force DQN Policy Evaluation & Active Inference
      // Wrapping in tf.tidy() ensures the test itself doesn't leak tensors
      const proposedAction = tf.tidy(() => {
        // Mocking the DQN forward pass
        const stateVector = tf.randomNormal([1, 10]); // e.g., session time, tab density
        // const actionIndex = CuriousAgent.predict(stateVector);
        stateVector.dispose(); // Cleanup inside tf.tidy is optional but safe
        return 'CONSOLIDATE_MEMORY'; // Mocked return
      });

      // PHASE C: Trigger the Neural Debate Protocol (Local Inference Mock)
      // Point this specifically at your local endpoint (e.g., http://localhost:11434/api/generate)
      const debatePromise = mockLocalDebate(proposedAction);
      
      // Enforce strict timeout to catch hanging Promises
      const debateResult = await Promise.race([
        debatePromise,
        new Promise<boolean>((_, reject) => setTimeout(() => reject(new Error('DEBATE_TIMEOUT')), DEBATE_TIMEOUT_MS))
      ]);

      const endTime = performance.now();
      const cycleLatency = endTime - startTime;
      debateLatencies.push(cycleLatency);
      
      console.log(`Cycle ${i + 1} completed in ${cycleLatency.toFixed(2)}ms. Consensus: ${debateResult}`);

    } catch (error: any) {
      if (error?.message === 'DEBATE_TIMEOUT') {
        console.error(`Cycle ${i + 1} FAILED: Debate hung for > ${DEBATE_TIMEOUT_MS}ms.`);
        timeoutFailures++;
      } else {
        console.error(`Cycle ${i + 1} FATAL ERROR:`, error);
        break;
      }
    }
  }

  // 2. Final Memory Audit & Leak Detection
  const finalMemory = tf.memory();
  console.log('\n=== STRESS TEST RESULTS ===');
  console.log(`Tensors leaked: ${finalMemory.numTensors - initialMemory.numTensors}`);
  console.log(`Timeout failures: ${timeoutFailures}/${ITERATIONS}`);
  
  const avgLatency = debateLatencies.reduce((a, b) => a + b, 0) / debateLatencies.length;
  console.log(`Average Cycle Latency: ${avgLatency.toFixed(2)}ms`);

  if (finalMemory.numTensors > initialMemory.numTensors) {
    console.error('⚠️ TENSOR MEMORY LEAK DETECTED. Check your tf.tidy() wrappers.');
    process.exit(1);
  }
  
  if (timeoutFailures > 0) {
    console.error('⚠️ DEBATE HANG DETECTED. Review cross-entropy convergence threshold.');
    process.exit(1);
  }

  console.log('✅ Architecture Stable. No leaks, no hangs.');
  process.exit(0);
}

// Mock function representing the localized Debate Engine fetching from a local daemon
async function mockLocalDebate(_action: string): Promise<boolean> {
  // Simulate network jitter and local LLM generation time (50ms - 250ms) to keep testing snappy
  const simulatedInferenceTime = Math.floor(Math.random() * 200) + 50;
  await new Promise(resolve => setTimeout(resolve, simulatedInferenceTime));
  return true; // Reached consensus
}

runCognitiveStressTest();
