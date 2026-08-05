import { dbShim as db } from "./firestore-shim.js";
import { EmotionSnapshot } from '../types.js';

export async function updateCircadianModel(userId: string) {
  
  const snapshotsRef = db.collection(`users/${userId}/soul/snapshots`);
  const snapshot = await snapshotsRef.orderBy('timestamp', 'desc').get();
  const snapshots = snapshot.docs.map((d: any) => d.data() as EmotionSnapshot);

  if (snapshots.length < 10) return; // Need more data

  // Simplified: compute mean
  const coeffs = fitFourierSimple(snapshots);
  
  await db.doc(`users/${userId}/soul/circadianModel`).set({
    userId,
    ...coeffs,
    updatedAt: Date.now()
  });
}

function fitFourierSimple(_snapshots: EmotionSnapshot[]) {
  // Return dummy coeffs for now
  const valenceCoeffs = [0, 0, 0, 0, 0];
  return { valenceCoeffs, arousalCoeffs: valenceCoeffs, dominanceCoeffs: valenceCoeffs };
}
