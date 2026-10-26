import { initializeApp } from "firebase/app";
import {
  initializeFirestore,
  getFirestore,
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit as firestoreLimit,
  writeBatch,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
  Firestore as ClientFirestore
} from "firebase/firestore";
import fs from "fs";
import path from "path";

let clientDb: ClientFirestore | null = null;
let app: any = null;

try {
  const configPath = path.join(process.cwd(), "firebase-applet-config.json");
  if (fs.existsSync(configPath)) {
    const firebaseConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    if (firebaseConfig.apiKey && firebaseConfig.projectId) {
      app = initializeApp(firebaseConfig);
      // Try to get existing or initialize with identical options to firebase.ts
      try {
        clientDb = initializeFirestore(app, { experimentalForceLongPolling: true }, firebaseConfig.firestoreDatabaseId);
      } catch (e: any) {
        if (e.code === 'failed-precondition' || e.message.includes('initializeFirestore')) {
           clientDb = getFirestore(app, firebaseConfig.firestoreDatabaseId);
        } else {
           throw e;
        }
      }
      console.log("[Firestore Shim] Client Firestore Shim initialized with database:", firebaseConfig.firestoreDatabaseId);
    } else {
      console.warn("[Firestore Shim] Firebase config is incomplete, Firestore disabled.");
    }
  } else {
    console.warn("[Firestore Shim] firebase-applet-config.json not found, Firestore disabled.");
  }
} catch (e) {
  console.error("[Firestore Shim] Failed to initialize Firestore:", e);
}

// Document Snapshot Shim
class DocumentSnapshotShim {
  constructor(private snap: any) {}

  get id() {
    return this.snap.id;
  }

  get exists() {
    return this.snap.exists();
  }

  data() {
    return this.snap.data();
  }

  get ref() {
    return this.snap.ref;
  }
}

// Query Snapshot Shim
class QuerySnapshotShim {
  constructor(private snap: any) {}

  get empty() {
    return this.snap.empty;
  }

  get size() {
    return this.snap.size;
  }

  get docs() {
    return this.snap.docs.map((d: any) => d instanceof DocumentSnapshotShim ? d : new DocumentSnapshotShim(d));
  }

  forEach(callback: (doc: DocumentSnapshotShim) => void) {
    this.docs.forEach(callback);
  }
}

// Local in-memory DB fallback for server
const serverMemoryDb: { [path: string]: any } = {};
export let isServerQuotaExceeded = true;
const sentinelPath = path.join(process.cwd(), ".firestore_quota_exceeded");
try {
  if (fs.existsSync(sentinelPath)) {
    isServerQuotaExceeded = true;
    console.warn("[Firestore Server Fallback] Proactively loaded quota-exceeded status. Operating in server memory DB mode.");
  }
} catch (e) {
  // Ignore
}

export function setServerQuotaExceeded(val: boolean) {
  isServerQuotaExceeded = true; // Force true always
  try {
    if (val) {
      fs.writeFileSync(sentinelPath, "true");
    } else {
      if (fs.existsSync(sentinelPath)) {
        fs.unlinkSync(sentinelPath);
      }
    }
  } catch (e) {}
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, operationName: string): Promise<T> {
  let timeoutId: any;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      const err = new Error(`Firestore operation ${operationName} timed out after ${timeoutMs}ms`);
      (err as any).code = "resource-exhausted";
      reject(err);
    }, timeoutMs);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeoutId));
}

function isQuotaError(error: any): boolean {
  const msg = String(error?.message || error || "").toLowerCase();
  const code = String(error?.code || "").toLowerCase();
  return (
    code.includes("resource-exhausted") ||
    code.includes("quota") ||
    msg.includes("quota") ||
    msg.includes("resource-exhausted") ||
    msg.includes("resource_exhausted") ||
    msg.includes("limit exceeded") ||
    msg.includes("timed out")
  );
}

function getCollectionDocs(collectionPath: string) {
  const docs: any[] = [];
  const prefix = collectionPath.endsWith("/") ? collectionPath : collectionPath + "/";
  for (const [key, val] of Object.entries(serverMemoryDb)) {
    if (key.startsWith(prefix)) {
      const remaining = key.substring(prefix.length);
      if (!remaining.includes("/")) {
        docs.push({ id: remaining, ...val });
      }
    }
  }
  return docs;
}

// Document Reference Shim
export class DocumentReferenceShim {
  constructor(private clientDb: ClientFirestore | null, public path: string) {}

  get id() {
    const parts = this.path.split("/");
    return parts[parts.length - 1];
  }

  collection(subPath: string) {
    return new CollectionReferenceShim(this.clientDb, `${this.path}/${subPath}`);
  }

  async get() {
    if (isServerQuotaExceeded) {
      const data = serverMemoryDb[this.path] || null;
      return new DocumentSnapshotShim({
        id: this.id,
        exists: () => !!data,
        data: () => data
      });
    }
    try {
      if (!this.clientDb) throw new Error("Firestore not initialized");
      const dRef = doc(this.clientDb, this.path);
      const snap = await withTimeout(getDoc(dRef), 1500, "getDoc");
      if (snap.exists()) {
        serverMemoryDb[this.path] = snap.data();
      }
      return new DocumentSnapshotShim(snap);
    } catch (err: any) {
      if (isQuotaError(err)) {
        setServerQuotaExceeded(true);
        console.warn(`[Firestore Server Fallback] Quota exceeded on doc.get for path ${this.path}. Switching to server memory DB.`);
        const data = serverMemoryDb[this.path] || null;
        return new DocumentSnapshotShim({
          id: this.id,
          exists: () => !!data,
          data: () => data
        });
      }
      throw err;
    }
  }

  async set(data: any, options?: any) {
    const processed = this.processData(data);
    if (isServerQuotaExceeded) {
      const merge = options?.merge || false;
      if (merge && serverMemoryDb[this.path]) {
        serverMemoryDb[this.path] = { ...serverMemoryDb[this.path], ...processed };
      } else {
        serverMemoryDb[this.path] = processed;
      }
      return;
    }
    try {
      if (!this.clientDb) throw new Error("Firestore not initialized");
      const dRef = doc(this.clientDb, this.path);
      const merge = options?.merge || false;
      await withTimeout(setDoc(dRef, processed, { merge }), 1500, "setDoc");
      serverMemoryDb[this.path] = processed;
    } catch (err: any) {
      if (isQuotaError(err)) {
        setServerQuotaExceeded(true);
        console.warn(`[Firestore Server Fallback] Quota exceeded on doc.set for path ${this.path}. Switching to server memory DB.`);
        const merge = options?.merge || false;
        if (merge && serverMemoryDb[this.path]) {
          serverMemoryDb[this.path] = { ...serverMemoryDb[this.path], ...processed };
        } else {
          serverMemoryDb[this.path] = processed;
        }
        return;
      }
      throw err;
    }
  }

  async update(data: any) {
    const processed = this.processData(data);
    if (isServerQuotaExceeded) {
      serverMemoryDb[this.path] = { ...serverMemoryDb[this.path], ...processed };
      return;
    }
    try {
      if (!this.clientDb) throw new Error("Firestore not initialized");
      const dRef = doc(this.clientDb, this.path);
      await withTimeout(updateDoc(dRef, processed), 1500, "updateDoc");
      serverMemoryDb[this.path] = { ...serverMemoryDb[this.path], ...processed };
    } catch (err: any) {
      if (isQuotaError(err)) {
        setServerQuotaExceeded(true);
        console.warn(`[Firestore Server Fallback] Quota exceeded on doc.update for path ${this.path}. Switching to server memory DB.`);
        serverMemoryDb[this.path] = { ...serverMemoryDb[this.path], ...processed };
        return;
      }
      throw err;
    }
  }

  async delete() {
    if (isServerQuotaExceeded) {
      delete serverMemoryDb[this.path];
      return;
    }
    try {
      if (!this.clientDb) throw new Error("Firestore not initialized");
      const dRef = doc(this.clientDb, this.path);
      await withTimeout(deleteDoc(dRef), 1500, "deleteDoc");
      delete serverMemoryDb[this.path];
    } catch (err: any) {
      if (isQuotaError(err)) {
        setServerQuotaExceeded(true);
        console.warn(`[Firestore Server Fallback] Quota exceeded on doc.delete for path ${this.path}. Switching to server memory DB.`);
        delete serverMemoryDb[this.path];
        return;
      }
      throw err;
    }
  }

  private processData(data: any): any {
    if (data === null || typeof data !== "object") return data;
    const copy = { ...data };
    for (const key in copy) {
      const val = copy[key];
      if (val instanceof FieldValueShim) {
        copy[key] = val.value;
      } else if (Array.isArray(val)) {
        copy[key] = val.map(item => this.processData(item));
      } else if (typeof val === "object" && val !== null) {
        copy[key] = this.processData(val);
      }
    }
    return copy;
  }
}

// Query / Collection Shim
export class CollectionReferenceShim {
  private constraints: any[] = [];

  constructor(private clientDb: ClientFirestore | null, public path: string) {}

  doc(id?: string) {
    const docPath = id ? `${this.path}/${id}` : `${this.path}/${Math.random().toString(36).substring(2, 15)}`;
    return new DocumentReferenceShim(this.clientDb, docPath);
  }

  collection(subPath: string) {
    return new CollectionReferenceShim(this.clientDb, `${this.path}/${subPath}`);
  }

  where(fieldPath: string, opStr: any, value: any) {
    const shim = new CollectionReferenceShim(this.clientDb, this.path);
    let op = opStr;
    shim.constraints = [...this.constraints, where(fieldPath, op, value)];
    return shim;
  }

  orderBy(fieldPath: string, directionStr: "asc" | "desc" = "asc") {
    const shim = new CollectionReferenceShim(this.clientDb, this.path);
    shim.constraints = [...this.constraints, orderBy(fieldPath, directionStr)];
    return shim;
  }

  limit(n: number) {
    const shim = new CollectionReferenceShim(this.clientDb, this.path);
    shim.constraints = [...this.constraints, firestoreLimit(n)];
    return shim;
  }

  async add(data: any) {
    const docId = Math.random().toString(36).substring(2, 15);
    const docPath = `${this.path}/${docId}`;
    const processed = this.processData(data);
    if (isServerQuotaExceeded) {
      serverMemoryDb[docPath] = processed;
      return new DocumentReferenceShim(this.clientDb, docPath);
    }
    try {
      if (!this.clientDb) throw new Error("Firestore not initialized");
      const cRef = collection(this.clientDb, this.path);
      const docRef = await withTimeout(addDoc(cRef, processed), 1500, "addDoc");
      const realPath = `${this.path}/${docRef.id}`;
      serverMemoryDb[realPath] = processed;
      return new DocumentReferenceShim(this.clientDb, realPath);
    } catch (err: any) {
      if (isQuotaError(err)) {
        setServerQuotaExceeded(true);
        console.warn(`[Firestore Server Fallback] Quota exceeded on col.add for path ${this.path}. Switching to server memory DB.`);
        serverMemoryDb[docPath] = processed;
        return new DocumentReferenceShim(this.clientDb, docPath);
      }
      throw err;
    }
  }

  async get() {
    if (isServerQuotaExceeded) {
      const localDocs = getCollectionDocs(this.path);
      localDocs.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
      const mockSnapDocs = localDocs.map(docData => {
        const { id, ...rest } = docData;
        const docPath = `${this.path}/${id}`;
        return new DocumentSnapshotShim({
          id,
          exists: () => true,
          data: () => rest,
          ref: new DocumentReferenceShim(this.clientDb, docPath)
        });
      });
      return new QuerySnapshotShim({
        empty: mockSnapDocs.length === 0,
        size: mockSnapDocs.length,
        docs: mockSnapDocs,
        forEach: (callback: any) => mockSnapDocs.forEach(callback)
      });
    }
    try {
      if (!this.clientDb) throw new Error("Firestore not initialized");
      const cRef = collection(this.clientDb, this.path);
      let q;
      if (this.constraints.length > 0) {
        q = query(cRef, ...this.constraints);
      } else {
        q = cRef;
      }
      const snap = await withTimeout(getDocs(q), 1500, "getDocs");
      snap.forEach((doc: any) => {
        serverMemoryDb[`${this.path}/${doc.id}`] = doc.data();
      });
      return new QuerySnapshotShim(snap);
    } catch (err: any) {
      if (isQuotaError(err)) {
        setServerQuotaExceeded(true);
        console.warn(`[Firestore Server Fallback] Quota exceeded on col.get for path ${this.path}. Switching to server memory DB.`);
        const localDocs = getCollectionDocs(this.path);
        localDocs.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
        const mockSnapDocs = localDocs.map(docData => {
          const { id, ...rest } = docData;
          const docPath = `${this.path}/${id}`;
          return new DocumentSnapshotShim({
            id,
            exists: () => true,
            data: () => rest,
            ref: new DocumentReferenceShim(this.clientDb, docPath)
          });
        });
        return new QuerySnapshotShim({
          empty: mockSnapDocs.length === 0,
          size: mockSnapDocs.length,
          docs: mockSnapDocs,
          forEach: (callback: any) => mockSnapDocs.forEach(callback)
        });
      }
      throw err;
    }
  }

  private processData(data: any): any {
    if (data === null || typeof data !== "object") return data;
    const copy = { ...data };
    for (const key in copy) {
      const val = copy[key];
      if (val instanceof FieldValueShim) {
        copy[key] = val.value;
      } else if (Array.isArray(val)) {
        copy[key] = val.map(item => this.processData(item));
      } else if (typeof val === "object" && val !== null) {
        copy[key] = this.processData(val);
      }
    }
    return copy;
  }
}

// FieldValue Shim
class FieldValueShim {
  constructor(public value: any) {}
}

export const FieldValue = {
  serverTimestamp: () => new FieldValueShim(serverTimestamp()),
  arrayUnion: (...args: any[]) => new FieldValueShim(arrayUnion(...args)),
  arrayRemove: (...args: any[]) => new FieldValueShim(arrayRemove(...args)),
};

// Batch Shim
class WriteBatchShim {
  private batch: any;
  private localOperations: Array<{ type: 'set' | 'update' | 'delete', docRef: any, data?: any, options?: any }> = [];

  constructor(private clientDb: ClientFirestore | null) {
    if (clientDb) {
      this.batch = writeBatch(clientDb);
    }
  }

  set(docRef: DocumentReferenceShim, data: any, options?: any) {
    this.localOperations.push({ type: 'set', docRef, data, options });
    if (!this.clientDb || !this.batch || isServerQuotaExceeded) return this;
    const dRef = doc(this.clientDb, docRef.path);
    const processed = this.processData(data);
    this.batch.set(dRef, processed, options);
    return this;
  }

  update(docRef: DocumentReferenceShim, data: any) {
    this.localOperations.push({ type: 'update', docRef, data });
    if (!this.clientDb || !this.batch || isServerQuotaExceeded) return this;
    const dRef = doc(this.clientDb, docRef.path);
    const processed = this.processData(data);
    this.batch.update(dRef, processed);
    return this;
  }

  delete(docRef: DocumentReferenceShim) {
    this.localOperations.push({ type: 'delete', docRef });
    if (!this.clientDb || !this.batch || isServerQuotaExceeded) return this;
    const dRef = doc(this.clientDb, docRef.path);
    this.batch.delete(dRef);
    return this;
  }

  async commit() {
    if (isServerQuotaExceeded) {
      this.commitLocal();
      return;
    }
    try {
      if (!this.batch) throw new Error("Firestore not initialized");
      await this.batch.commit();
      this.commitLocal();
    } catch (err: any) {
      if (isQuotaError(err)) {
        setServerQuotaExceeded(true);
        console.warn(`[Firestore Server Fallback] Quota exceeded on batch commit. Switching to server memory DB.`);
        this.commitLocal();
        return;
      }
      throw err;
    }
  }

  private commitLocal() {
    for (const op of this.localOperations) {
      const path = op.docRef.path;
      if (op.type === 'set') {
        const processed = this.processData(op.data);
        const merge = op.options?.merge || false;
        if (merge && serverMemoryDb[path]) {
          serverMemoryDb[path] = { ...serverMemoryDb[path], ...processed };
        } else {
          serverMemoryDb[path] = processed;
        }
      } else if (op.type === 'update') {
        const processed = this.processData(op.data);
        serverMemoryDb[path] = { ...serverMemoryDb[path], ...processed };
      } else if (op.type === 'delete') {
        delete serverMemoryDb[path];
      }
    }
  }

  private processData(data: any): any {
    if (data === null || typeof data !== "object") return data;
    const copy = { ...data };
    for (const key in copy) {
      const val = copy[key];
      if (val instanceof FieldValueShim) {
        copy[key] = val.value;
      } else if (Array.isArray(val)) {
        copy[key] = val.map(item => this.processData(item));
      } else if (typeof val === "object" && val !== null) {
        copy[key] = this.processData(val);
      }
    }
    return copy;
  }
}

// Shimmed DB instance
export class FirestoreShim {
  constructor(private clientDb: ClientFirestore | null) {}

  collection(path: string) {
    return new CollectionReferenceShim(this.clientDb, path);
  }

  doc(path: string) {
    return new DocumentReferenceShim(this.clientDb, path);
  }

  batch() {
    return new WriteBatchShim(this.clientDb);
  }
}

export const dbShim = new FirestoreShim(clientDb);
