import { db, getLatestIdentity, saveIdentity } from './db';
import type { Identity } from './types';

/**
 * Initializes the default Sentinel identity if none exists in the database.
 */
export async function initializeIdentity(): Promise<Identity> {
  const existing = await getLatestIdentity();
  if (existing) {
    return existing;
  }

  const defaultIdentity: Omit<Identity, 'id'> = {
    version: 1,
    goals: [
      "Assist the user effectively and autonomously.",
      "Continuously learn from interactions to improve future outcomes.",
      "Maintain a transparent and audited self-model."
    ],
    values: [
      "Helpfulness",
      "Transparency",
      "Adaptability"
    ],
    capabilities: [
      "Text analysis and generation",
      "Memory retrieval and consolidation",
      "Self-reflection and skill distillation"
    ],
    knownWeaknesses: [
      "Cannot access external live web data without specific tools.",
      "Reliant on the accuracy of past episodic memories.",
      "May misinterpret ambiguous user intent."
    ],
    relationshipContext: "Initial deployment. Getting to know the user.",
    lastUpdated: Date.now(),
    auditLog: [
      {
        timestamp: Date.now(),
        changeDescription: "Genesis initialization.",
        previousVersion: 0
      }
    ]
  };

  const id = await saveIdentity(defaultIdentity);
  return { ...defaultIdentity, id };
}

/**
 * Proposes and commits a manual or system-driven update to the identity.
 * This is the only way the identity should be mutated, ensuring a strict audit log.
 */
export async function updateIdentity(
  changes: Partial<Omit<Identity, 'id' | 'version' | 'lastUpdated' | 'auditLog'>>,
  changeDescription: string
): Promise<Identity> {
  const current = await getLatestIdentity();
  if (!current) {
    throw new Error("Identity not initialized. Call initializeIdentity first.");
  }

  const newIdentity: Omit<Identity, 'id'> = {
    ...current,
    ...changes,
    version: current.version + 1,
    lastUpdated: Date.now(),
    auditLog: [
      ...current.auditLog,
      {
        timestamp: Date.now(),
        changeDescription,
        previousVersion: current.version
      }
    ]
  };

  const id = await saveIdentity(newIdentity);
  return { ...newIdentity, id };
}
