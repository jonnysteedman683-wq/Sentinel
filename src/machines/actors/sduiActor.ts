import { fromPromise } from 'xstate';

// Pillar #2: Server-Driven UI (JSON schema rendering)
// Models the asynchronous network request to fetch UI schema.
export const sduiActor = fromPromise<any, { widgetId: string }>(async ({ input }) => {
  // Simulate network request to fetch SDUI schema
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (!input.widgetId) {
        reject(new Error("Widget ID is required"));
      } else {
        resolve({
          id: input.widgetId,
          type: 'DashboardWidget',
          schema: {
            title: `Dynamic Widget ${input.widgetId}`,
            components: [
              { type: 'Chart', dataRef: 'chartData' },
              { type: 'List', dataRef: 'listData' }
            ]
          },
          timestamp: Date.now()
        });
      }
    }, 100);
  });
});
