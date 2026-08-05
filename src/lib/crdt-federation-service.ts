// FILE: src/lib/crdt-federation-service.ts — [Handles Firestore syncing and merging for CRDT synapses]
import { dbShim as db } from "./firestore-shim.js";
import { CRDTSynapse, SynapticPayload } from "./crdt-synapse.js";

export async function syncFederatedSynapses(userId: string, clientId: string, localUpdates: SynapticPayload[]): Promise<SynapticPayload[]> {
  const fedRef = db.collection(`users/${userId}/federatedSynapses`);
  const batch = db.batch();
  
  // Create a local CRDT instance to merge with incoming data
  const localCrdt = new CRDTSynapse(clientId, localUpdates);

  // Pull global state
  const snapshot = await fedRef.get();
  const globalPayloads = snapshot.docs.map((d: any) => d.data() as SynapticPayload);

  // Merge global into local
  localCrdt.merge(globalPayloads);

  // Push resulting merged state back to Firestore (idempotent writes)
  const mergedPayloads = localCrdt.exportState();
  
  for (const payload of mergedPayloads) {
    const docRef = fedRef.doc(localCrdt.edgeId(payload.source, payload.target));
    batch.set(docRef, payload, { merge: true });
  }

  if (mergedPayloads.length > 0) {
    await batch.commit();
  }

  return mergedPayloads;
}
