import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';
dotenv.config();

const app = initializeApp({
  credential: cert(require('../service-account-key.json')),
});
const db = getFirestore();

async function migrate() {
  const usersSnap = await db.collection('users').get();
  for (const userDoc of usersSnap.docs) {
    const userId = userDoc.id;
    const memSnap = await db.collection(`users/${userId}/memories`).get();
    for (const doc of memSnap.docs) {
      const data = doc.data();
      if (data.strength === undefined) {
        await doc.ref.set({
          strength: 0.5,
          state: 'shortTerm',
          lastAccessed: data.createdAt || new Date(),
          accessCount: 0,
          decayRate: 0.005,
          linkedMemories: data.linkedMemories || [],
        }, { merge: true });
      }
    }
  }
  console.log('Migration complete');
  process.exit(0);
}

migrate().catch(err => { console.error(err); process.exit(1); });
