import cron from "node-cron";
import { dbShim as db } from "./firestore-shim.js";
import { runDreamCycle } from "./dream-engine.js";

export function initializeDreamScheduler() {
  cron.schedule('0 3 * * *', async () => {
    if (!db) return;
    try {
      console.log('Running nightly Dream Cycle for all users...');
      const usersSnap = await db.collection('users').limit(1000).get();
      for (const doc of usersSnap.docs) {
        try {
          await runDreamCycle(doc.id);
          console.log(`Nightly dream cycle completed for ${doc.id}`);
        } catch (e) {
          console.error(`Error running dream cycle for ${doc.id}:`, e);
        }
      }
    } catch (e) {
      console.error('Error running nightly dream cycle cron:', e);
    }
  });
}
