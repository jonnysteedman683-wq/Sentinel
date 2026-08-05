import Dexie from 'dexie';

export interface CachedMemory {
  id: string;
  userId: string;
  state: string; // 'core', 'shortTerm', 'longTerm', 'wisdom'
  content: string;
  embedding?: number[]; // High-dimensional state vectors
  lastAccessed: number;
  updatedAt: number;
}

const DexieClass = (Dexie as any).default || Dexie;

export const localDb = new DexieClass('AQBLocalDatabase') as any;

// Schema versioning
localDb.version(1).stores({
  memories: 'id, [userId+state], lastAccessed, updatedAt'
});
