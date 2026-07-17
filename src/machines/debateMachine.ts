import { setup, assign, fromPromise } from 'xstate';

export interface DebateLogEntry {
  agent: string;
  move: string;
  text: string;
  confidence: number;
}

export interface DebateMachineContext {
  topic: string;
  contextData: string;
  transcript: string;
  turns: number;
  maxTurns: number;
  activeAgentId: 'logician' | 'catalyst' | 'auditor' | null;
  debateLog: DebateLogEntry[];
  currentStateVector: number[];
  finalSynthesis: string;
  selfAnalysis: string;
  extractedMemory: string | null;
  extractedTags: string[];
  error: string | null;
}

export type DebateMachineEvent =
  | { type: 'START_DEBATE'; topic: string; contextData: string }
  | { type: 'RESET' }
  | { type: 'RETRY' };

// Actor to call a single step of the debate
const executeDebateStepActor = fromPromise<
  { agent: string; move: string; text: string; confidence: number },
  { message: string; contextData: string; agentId: string; transcript: string; currentState: number[] }
>(async ({ input }) => {
  const res = await fetch('/api/debate/step', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: input.message,
      contextData: input.contextData,
      agentId: input.agentId,
      transcript: input.transcript,
      currentState: input.currentState
    })
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to generate debate step');
  }
  return res.json();
});

// Actor to evaluate the current debate state
const evaluateDebateStateActor = fromPromise<
  { state: number[] },
  { transcript: string; topic: string }
>(async ({ input }) => {
  const res = await fetch('/api/debate/evaluate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      transcript: input.transcript,
      topic: input.topic
    })
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to evaluate debate state');
  }
  return res.json();
});

// Actor to synthesize the final moderated response
const synthesizeDebateActor = fromPromise<
  { text: string; selfAnalysis: string; extractedMemory: string | null; extractedTags: string[] },
  { message: string; transcript: string }
>(async ({ input }) => {
  const res = await fetch('/api/debate/synthesize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: input.message,
      transcript: input.transcript
    })
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to synthesize debate response');
  }
  return res.json();
});

export const debateMachine = setup({
  types: {
    context: {} as DebateMachineContext,
    events: {} as DebateMachineEvent
  },
  actors: {
    executeDebateStepActor,
    evaluateDebateStateActor,
    synthesizeDebateActor
  },
  actions: {
    initContext: assign(({ event }) => {
      const startEvent = event as { type: 'START_DEBATE'; topic: string; contextData: string };
      return {
        topic: startEvent.topic,
        contextData: startEvent.contextData,
        transcript: '',
        turns: 0,
        maxTurns: 3,
        activeAgentId: 'logician' as const,
        debateLog: [],
        currentStateVector: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5],
        finalSynthesis: '',
        selfAnalysis: '',
        extractedMemory: null,
        extractedTags: [],
        error: null
      };
    }),
    updateActiveAgent: assign({
      activeAgentId: ({ context }) => {
        const agents = ['logician', 'catalyst', 'auditor'] as const;
        return agents[context.turns % agents.length];
      }
    }),
    saveStepResult: assign(({ context, event }) => {
      const stepOutput = (event as any).output as DebateLogEntry;
      const nextLog = [...context.debateLog, stepOutput];
      const entry = `${stepOutput.agent} (${stepOutput.move}): ${stepOutput.text}`;
      const nextTranscript = context.transcript + entry + "\n\n";
      return {
        debateLog: nextLog,
        transcript: nextTranscript,
        turns: context.turns + 1
      };
    }),
    saveEvaluationResult: assign({
      currentStateVector: ({ event }) => (event as any).output.state
    }),
    saveSynthesisResult: assign({
      finalSynthesis: ({ event }) => (event as any).output.text,
      selfAnalysis: ({ event }) => (event as any).output.selfAnalysis,
      extractedMemory: ({ event }) => (event as any).output.extractedMemory,
      extractedTags: ({ event }) => (event as any).output.extractedTags
    }),
    setError: assign({
      error: ({ event }) => (event as any).error?.message || 'An unknown error occurred during debate'
    }),
    resetContext: assign({
      topic: '',
      contextData: '',
      transcript: '',
      turns: 0,
      activeAgentId: null,
      debateLog: [],
      currentStateVector: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5],
      finalSynthesis: '',
      selfAnalysis: '',
      extractedMemory: null,
      extractedTags: [],
      error: null
    })
  }
}).createMachine({
  id: 'debateMachine',
  initial: 'idle',
  context: {
    topic: '',
    contextData: '',
    transcript: '',
    turns: 0,
    maxTurns: 3,
    activeAgentId: null,
    debateLog: [],
    currentStateVector: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5],
    finalSynthesis: '',
    selfAnalysis: '',
    extractedMemory: null,
    extractedTags: [],
    error: null
  },
  states: {
    idle: {
      on: {
        START_DEBATE: {
          target: 'initializing',
          actions: 'initContext'
        }
      }
    },
    initializing: {
      always: {
        target: 'decidingMove'
      }
    },
    decidingMove: {
      entry: 'updateActiveAgent',
      always: {
        target: 'generatingUtterance'
      }
    },
    generatingUtterance: {
      invoke: {
        src: 'executeDebateStepActor',
        input: ({ context }) => ({
          message: context.topic,
          contextData: context.contextData,
          agentId: context.activeAgentId!,
          transcript: context.transcript,
          currentState: context.currentStateVector
        }),
        onDone: {
          target: 'evaluatingState',
          actions: 'saveStepResult'
        },
        onError: {
          target: 'failure',
          actions: 'setError'
        }
      }
    },
    evaluatingState: {
      invoke: {
        src: 'evaluateDebateStateActor',
        input: ({ context }) => ({
          transcript: context.transcript,
          topic: context.topic
        }),
        onDone: {
          target: 'checkTurns',
          actions: 'saveEvaluationResult'
        },
        onError: {
          target: 'failure',
          actions: 'setError'
        }
      }
    },
    checkTurns: {
      always: [
        {
          guard: ({ context }) => context.turns < context.maxTurns,
          target: 'decidingMove'
        },
        {
          target: 'synthesizingConsensus'
        }
      ]
    },
    synthesizingConsensus: {
      invoke: {
        src: 'synthesizeDebateActor',
        input: ({ context }) => ({
          message: context.topic,
          transcript: context.transcript
        }),
        onDone: {
          target: 'consensusReached',
          actions: 'saveSynthesisResult'
        },
        onError: {
          target: 'failure',
          actions: 'setError'
        }
      }
    },
    consensusReached: {
      on: {
        RESET: {
          target: 'idle',
          actions: 'resetContext'
        },
        START_DEBATE: {
          target: 'initializing',
          actions: 'initContext'
        }
      }
    },
    failure: {
      on: {
        RETRY: {
          target: 'decidingMove',
          actions: assign({ error: null })
        },
        RESET: {
          target: 'idle',
          actions: 'resetContext'
        }
      }
    }
  }
});
