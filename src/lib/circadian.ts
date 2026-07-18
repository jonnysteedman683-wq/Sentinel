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
  // Generate dynamic dummy coeffs based on time of day until we have enough real user data
  // These simulate a typical human circadian rhythm (higher arousal midday, lower at night)
  const hour = new Date().getHours();
  const timeFactor = (hour / 24.0) * 2 * Math.PI; // 0 to 2pi
  
  // Base term, cos(t), sin(t), cos(2t), sin(2t)
  const valenceCoeffs = [
    0.5, // Base valence
    Math.cos(timeFactor) * 0.2,
    Math.sin(timeFactor) * 0.1,
    0, 0
  ];
  
  const arousalCoeffs = [
    0.5, // Base arousal
    -Math.cos(timeFactor) * 0.4, // lower at night (hour 0/24), higher midday (hour 12)
    Math.sin(timeFactor) * 0.2,
    0, 0
  ];

  const dominanceCoeffs = [
    0.6,
    Math.cos(timeFactor) * 0.1,
    0, 0, 0
  ];

  return { valenceCoeffs, arousalCoeffs, dominanceCoeffs };
}
