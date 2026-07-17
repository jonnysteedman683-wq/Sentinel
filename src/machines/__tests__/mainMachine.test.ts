import { describe, it, expect } from 'vitest';
import { createActor } from 'xstate';
import { mainMachine } from '../mainMachine.js';

describe('mainMachine (CPU Optimized Orchestrator)', () => {
  it('should handle batch commit boundaries without processing individual signal updates', () => {
    const actor = createActor(mainMachine).start();
    
    expect(actor.getSnapshot().value).toStrictEqual({ Orchestrating: 'Idle' });
    expect(actor.getSnapshot().context.isBatchCommitting).toBe(false);

    // Start a batch commit (Pillar #3 commit boundary)
    actor.send({ type: 'START_BATCH' });
    
    const snapshot = actor.getSnapshot();
    expect(snapshot.value).toStrictEqual({ Orchestrating: 'BatchCommitting' });
    expect(snapshot.context.isBatchCommitting).toBe(true);
    
    // End batch commit
    actor.send({ type: 'END_BATCH' });
    expect(actor.getSnapshot().value).toStrictEqual({ Orchestrating: 'Idle' });
    expect(actor.getSnapshot().context.isBatchCommitting).toBe(false);

    actor.stop();
  });

  it('should fetch SDUI schema asynchronously', async () => {
    const actor = createActor(mainMachine).start();
    
    actor.send({ type: 'FETCH_SDUI', widgetId: 'test-widget' });
    expect(actor.getSnapshot().value).toStrictEqual({ Orchestrating: 'FetchingSDUI' });
    
    await new Promise(r => setTimeout(r, 150));
    
    expect(actor.getSnapshot().value).toStrictEqual({ Orchestrating: 'Idle' });
    expect(actor.getSnapshot().context.schema.id).toBe('test-widget');

    actor.stop();
  });

  it('should run predictive inference asynchronously', async () => {
    const actor = createActor(mainMachine).start();
    
    actor.send({ type: 'PREDICT_NEXT' });
    expect(actor.getSnapshot().value).toBe('Predicting');
    
    await new Promise(r => setTimeout(r, 100));
    
    expect(actor.getSnapshot().value).toStrictEqual({ Orchestrating: 'Idle' });
    expect(actor.getSnapshot().context.predictions.confidence).toBe(0.92);

    actor.stop();
  });
});
