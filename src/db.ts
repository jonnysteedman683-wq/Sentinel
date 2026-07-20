import { Dexie, type EntityTable } from 'dexie';
import { Episode, SemanticEntry, SkillCard, Identity } from './types.js';

// We map the requested schema names to the types
export interface EpisodicMemory extends Episode {}
export interface SemanticMemory extends SemanticEntry {}
export interface SkillLibrary extends SkillCard {}
export interface IdentityLog extends Identity {
  id: string; // Add id for Dexie primary key
  timestamp: number;
}

export class SentinelDatabase extends Dexie {
  episodicMemory!: EntityTable<EpisodicMemory, 'id'>;
  semanticMemory!: EntityTable<SemanticMemory, 'id'>;
  skillLibrary!: EntityTable<SkillLibrary, 'id'>;
  identityLog!: EntityTable<IdentityLog, 'id'>;

  constructor() {
    super('SentinelDB');
    this.version(1).stores({
      episodicMemory: 'id, timestamp, trigger, outcome',
      semanticMemory: 'id, concept, strength, lastAccessed',
      skillLibrary: 'id, name, successRate, useCount, lastUsed',
      identityLog: 'id, timestamp'
    });
  }
}

export const db = new SentinelDatabase();

// --- CRUD Functions for EpisodicMemory ---
export async function addEpisodicMemory(episode: EpisodicMemory): Promise<string> {
  return await db.episodicMemory.add(episode);
}

export async function getEpisodicMemory(id: string): Promise<EpisodicMemory | undefined> {
  return await db.episodicMemory.get(id);
}

export async function updateEpisodicMemory(id: string, changes: Partial<EpisodicMemory>): Promise<number> {
  return await db.episodicMemory.update(id, changes);
}

export async function deleteEpisodicMemory(id: string): Promise<void> {
  await db.episodicMemory.delete(id);
}

// --- CRUD Functions for SemanticMemory ---
export async function addSemanticMemory(entry: SemanticMemory): Promise<string> {
  return await db.semanticMemory.add(entry);
}

export async function getSemanticMemory(id: string): Promise<SemanticMemory | undefined> {
  return await db.semanticMemory.get(id);
}

export async function updateSemanticMemory(id: string, changes: Partial<SemanticMemory>): Promise<number> {
  return await db.semanticMemory.update(id, changes);
}

export async function deleteSemanticMemory(id: string): Promise<void> {
  await db.semanticMemory.delete(id);
}

// --- CRUD Functions for SkillLibrary ---
export async function addSkill(skill: SkillLibrary): Promise<string> {
  return await db.skillLibrary.add(skill);
}

export async function getSkill(id: string): Promise<SkillLibrary | undefined> {
  return await db.skillLibrary.get(id);
}

export async function updateSkill(id: string, changes: Partial<SkillLibrary>): Promise<number> {
  return await db.skillLibrary.update(id, changes);
}

export async function deleteSkill(id: string): Promise<void> {
  await db.skillLibrary.delete(id);
}

// --- CRUD Functions for IdentityLog ---
export async function addIdentityLog(log: IdentityLog): Promise<string> {
  return await db.identityLog.add(log);
}

export async function getIdentityLog(id: string): Promise<IdentityLog | undefined> {
  return await db.identityLog.get(id);
}

export async function updateIdentityLog(id: string, changes: Partial<IdentityLog>): Promise<number> {
  return await db.identityLog.update(id, changes);
}

export async function deleteIdentityLog(id: string): Promise<void> {
  await db.identityLog.delete(id);
}
