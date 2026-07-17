import { dbShim as db } from "./firestore-shim.js";
import { reinforceMemory } from './memory-lifecycle.js';
import { MemoryNode } from '../types.js';
import { publishEvent } from './events.js';

export async function touchMemory(userId: string, memoryId: string) {
  
  const ref = db.doc(`users/${userId}/memories/${memoryId}`);
  const snap = await ref.get();
  if (!snap.exists) return;
  const mem = { id: snap.id, ...snap.data() } as MemoryNode;
  const updated = reinforceMemory(mem);
  await ref.set(updated, { merge: true });
  await publishEvent(userId, 'memory', 'MEMORY_REINFORCED', { memoryId });
}
