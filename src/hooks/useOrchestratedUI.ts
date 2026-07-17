import { useEffect, useRef } from 'react';
import { useMachine } from '@xstate/react';
import { mainMachine } from '../machines/mainMachine.js';

/**
 * Custom hook to interface with the FSM Orchestrator (Pillar #1).
 * CPU OPTIMIZED: High-frequency signal commits bypass the XState actor entirely.
 * We use a mutable ref (representing Pillar #3 Signals) for telemetry/canvas updates 
 * that get applied directly to the DOM to prevent FSM overhead and CPU contention.
 */
export function useOrchestratedUI(initialLayout: string) {
  const [snapshot, send] = useMachine(mainMachine);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Pillar #3: Fine-Grained Signals
  // In a real app this would be a Preact/Solid Signal. We simulate the bypass with a ref.
  const highFrequencySignalRef = useRef<Record<string, any>>({});

  // Initialize the orchestrator with the requested layout
  useEffect(() => {
    send({
      type: 'CHANGE_LAYOUT',
      layout: initialLayout
    });
    
    // Kick off predictive inference (Pillar #4)
    send({ type: 'PREDICT_NEXT' });
  }, [initialLayout, send]);

  useEffect(() => {
    const handleHighFrequencyTelemetry = (e: MouseEvent) => {
      // Defensive Guard: If XState unmounted the element, abort the mutation
      if (!containerRef.current) return;

      // Decouple the DOM write from React's standard render cycle
      requestAnimationFrame(() => {
        if (containerRef.current) {
          containerRef.current.style.transform = `translate(${e.clientX * 0.01}px, ${e.clientY * 0.01}px)`;
        }
      });
    };

    window.addEventListener('mousemove', handleHighFrequencyTelemetry);
    return () => window.removeEventListener('mousemove', handleHighFrequencyTelemetry);
  }, []);

  // Expose methods for the UI layer to interact with the FSM
  return {
    // Current Global State
    layout: snapshot.context.layout,
    schema: snapshot.context.schema,
    predictions: snapshot.context.predictions,
    isBatchCommitting: snapshot.context.isBatchCommitting,
    containerRef,
    
    // Actions
    changeLayout: (layout: string) => {
      send({ type: 'CHANGE_LAYOUT', layout });
      send({ type: 'PREDICT_NEXT' });
    },
    
    fetchSDUI: (widgetId: string) => {
      send({ type: 'FETCH_SDUI', widgetId });
    },
    
    // CPU OPTIMIZATION: Signal Bypass
    // This updates the local signal without triggering an FSM transition.
    // It is used for 60fps canvas/telemetry updates (avoiding state explosion/contention).
    updateSignalFast: (key: string, value: any) => {
      highFrequencySignalRef.current[key] = value;
      // In a real scenario, this would trigger a direct DOM update via signal subscription,
      // skipping the React render cycle completely.
    },
    
    // Commit boundary for batching multiple high-frequency updates or syncing
    startBatchCommit: () => {
      send({ type: 'START_BATCH' });
    },
    
    endBatchCommit: () => {
      // End the commit transaction
      send({ type: 'END_BATCH' });
    }
  };
}
