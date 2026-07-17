import { setup, assign } from 'xstate';
import { sduiActor } from './actors/sduiActor.js';
import { predictiveActor } from './actors/predictiveActor.js';

/**
 * Mermaid State Chart (CPU-Optimized FSM)
 * 
 * stateDiagram-v2
 *   [*] --> Orchestrating
 *   
 *   state Orchestrating {
 *     [*] --> Idle
 *     Idle --> BatchCommitting : START_BATCH
 *     BatchCommitting --> Idle : END_BATCH
 *     Idle --> FetchingSDUI : FETCH_SDUI
 *     FetchingSDUI --> Idle : SDUI_FETCHED
 *   }
 *   
 *   Orchestrating --> Predicting : PREDICT_NEXT
 *   Predicting --> Orchestrating : PREDICTION_DONE
 */

interface MainContext {
  layout: string;
  schema: any;
  predictions: any;
  isBatchCommitting: boolean;
  error: string | null;
}

// Pillar #1: Deterministic State-Chart Transitions
// CPU OPTIMIZED: The FSM does NOT process high-frequency signals. It only orchestrates
// layout, predictive pre-fetching, and transaction boundaries (batch commits).
export const mainMachine = setup({
  types: {
    context: {} as MainContext,
    events: {} as 
      | { type: 'CHANGE_LAYOUT'; layout: string }
      | { type: 'PREDICT_NEXT' }
      | { type: 'START_BATCH' }
      | { type: 'END_BATCH' }
      | { type: 'FETCH_SDUI'; widgetId: string }
  },
  actors: { predictiveActor, sduiActor },
  actions: {
    updateLayout: assign({
      layout: ({ event }) => (event as any).layout
    }),
    savePrediction: assign({
      predictions: ({ event }) => (event as any).output
    }),
    setBatching: assign({
      isBatchCommitting: true
    }),
    clearBatching: assign({
      isBatchCommitting: false
    }),
    saveSchema: assign({
      schema: ({ event }) => (event as any).output,
      error: null
    }),
    setError: assign({
      error: ({ event }) => (event as any).error.message
    })
  }
}).createMachine({
  id: 'mainMachine',
  initial: 'Orchestrating',
  context: {
    layout: 'dashboard',
    schema: null,
    predictions: null,
    isBatchCommitting: false,
    error: null
  },
  states: {
    Orchestrating: {
      initial: 'Idle',
      states: {
        Idle: {
          on: {
            START_BATCH: {
              target: 'BatchCommitting',
              actions: 'setBatching'
            },
            FETCH_SDUI: 'FetchingSDUI'
          }
        },
        BatchCommitting: {
          on: {
            END_BATCH: {
              target: 'Idle',
              actions: 'clearBatching'
            }
          }
        },
        FetchingSDUI: {
          invoke: {
            src: 'sduiActor',
            input: ({ event }) => ({ widgetId: (event as any).widgetId }),
            onDone: {
              target: 'Idle',
              actions: 'saveSchema'
            },
            onError: {
              target: 'Idle',
              actions: 'setError'
            }
          }
        }
      },
      on: {
        CHANGE_LAYOUT: {
          actions: 'updateLayout'
        },
        PREDICT_NEXT: 'Predicting'
      }
    },
    Predicting: {
      invoke: {
        src: 'predictiveActor',
        input: ({ context }) => ({ 
          currentLayout: context.layout, 
          activeWidgets: [] 
        }),
        onDone: {
          target: 'Orchestrating',
          actions: 'savePrediction'
        },
        onError: 'Orchestrating'
      }
    }
  }
});
