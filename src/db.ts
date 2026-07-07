import Dexie, { type Table } from 'dexie';
import type { Episode, SemanticEntry, SkillCard, Identity, AutonomyAction, ActionStatus, AgentProfile, PromptEntry } from './types';

export class SentinelDatabase extends Dexie {
  episodes!: Table<Episode, string>;
  semanticEntries!: Table<SemanticEntry, string>;
  skills!: Table<SkillCard, string>;
  identities!: Table<Identity, string>;
  actions!: Table<AutonomyAction, string>;
  agents!: Table<AgentProfile, string>;
  prompts!: Table<PromptEntry, string>;
  banditArms!: Table<any, number>;
  banditDecisions!: Table<any, number>;

  constructor() {
    super('SentinelDB');
    
    // Define schemas. 'id' is the primary key. *tags creates a multi-entry index for arrays.
    this.version(1).stores({
      episodes: 'id, type, timestamp, *tags',
      semanticEntries: 'id, timestamp, retrievalCount, *tags',
      skills: 'id, name, successScore, lastUpdated',
      identities: 'id, version, lastUpdated',
      actions: 'id, status, tier, timestamp'
    });
    
    // Version 2 for vector embeddings
    this.version(2).stores({
      episodes: 'id, type, timestamp, *tags, embedding',
      semanticEntries: 'id, timestamp, retrievalCount, *tags, embedding'
    });

    // Version 3 for Agents & Prompts
    this.version(3).stores({
      agents: 'id, name, role, status, createdAt',
      prompts: 'id, title, *tags, createdAt'
    });

    // Version 4 for Skill Tree hierarchy
    this.version(4).stores({
      skills: 'id, name, successScore, lastUpdated, parentId, upgradesFromId'
    }).upgrade(tx => {
       return tx.table('skills').toCollection().modify(skill => {
           if (skill.tier === undefined) skill.tier = 1;
       });
    });

    // Version 5 for Multi-Armed Bandit state
    this.version(5).stores({
      banditArms: '++id, agentId, taskType, [agentId+taskType], updatedAt',
      banditDecisions: '++id, agentId, taskType, timestamp',
    });
  }
}

export const db = new SentinelDatabase();

// ==========================================
// EPISODIC MEMORY
// ==========================================
export async function addEpisode(episode: Omit<Episode, 'id'>): Promise<string> {
  const id = crypto.randomUUID();
  await db.episodes.add({ ...episode, id });
  return id;
}

export async function getAllEpisodes(): Promise<Episode[]> {
  return db.episodes.orderBy('timestamp').reverse().toArray();
}

export async function getEpisodesByTimeRange(start: number, end: number): Promise<Episode[]> {
  return db.episodes.where('timestamp').between(start, end).toArray();
}

export async function deleteEpisodes(ids: string[]): Promise<void> {
  await db.episodes.bulkDelete(ids);
}

// ==========================================
// SEMANTIC MEMORY
// ==========================================
export async function addSemanticEntry(entry: Omit<SemanticEntry, 'id'>): Promise<string> {
  const id = crypto.randomUUID();
  await db.semanticEntries.add({ ...entry, id });
  return id;
}

export async function getAllSemanticEntries(): Promise<SemanticEntry[]> {
  return db.semanticEntries.orderBy('timestamp').reverse().toArray();
}

export async function incrementRetrievalCount(id: string): Promise<void> {
  const entry = await db.semanticEntries.get(id);
  if (entry) {
    await db.semanticEntries.update(id, { retrievalCount: entry.retrievalCount + 1 });
  }
}

export async function deleteSemanticEntries(ids: string[]): Promise<void> {
  await db.semanticEntries.bulkDelete(ids);
}

// ==========================================
// SKILLS
// ==========================================
export async function addSkill(skill: Omit<SkillCard, 'id'>): Promise<string> {
  const id = crypto.randomUUID();
  await db.skills.add({ ...skill, id });
  return id;
}

export async function updateSkill(id: string, updates: Partial<SkillCard>): Promise<void> {
  await db.skills.update(id, { ...updates, lastUpdated: Date.now() });
}

export async function getSkill(id: string): Promise<SkillCard | undefined> {
  return db.skills.get(id);
}

export async function getAllSkills(): Promise<SkillCard[]> {
  return db.skills.orderBy('successScore').reverse().toArray();
}

// ==========================================
// IDENTITY
// ==========================================
export async function getLatestIdentity(): Promise<Identity | undefined> {
  const identities = await db.identities.orderBy('version').reverse().limit(1).toArray();
  return identities[0];
}

export async function saveIdentity(identity: Omit<Identity, 'id'>): Promise<string> {
  const id = crypto.randomUUID();
  await db.identities.add({ ...identity, id });
  return id;
}

export async function getIdentityHistory(): Promise<Identity[]> {
  return db.identities.orderBy('version').reverse().toArray();
}

// ==========================================
// AUTONOMY ACTIONS
// ==========================================
export async function addAction(action: Omit<AutonomyAction, 'id'>): Promise<string> {
  const id = crypto.randomUUID();
  await db.actions.add({ ...action, id });
  return id;
}

export async function updateActionStatus(id: string, status: ActionStatus): Promise<void> {
  await db.actions.update(id, { status });
}

export async function getActionsByStatus(status: ActionStatus): Promise<AutonomyAction[]> {
  return db.actions.where('status').equals(status).reverse().sortBy('timestamp');
}

export async function getAllActions(): Promise<AutonomyAction[]> {
  return db.actions.orderBy('timestamp').reverse().toArray();
}
