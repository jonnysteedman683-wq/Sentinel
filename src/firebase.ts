import { initializeApp, getApp, getApps } from "firebase/app";
import { initializeFirestore, getFirestore as firebaseGetFirestore } from "firebase/firestore";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut as firebaseSignOut, signInAnonymously, onAuthStateChanged } from "firebase/auth";
import firebaseConfig from "../firebase-applet-config.json" with { type: "json" };

if (!firebaseConfig || !firebaseConfig.apiKey) {
  console.error("[Firebase] Critical: firebase-applet-config.json is missing or invalid. Deployment will be degraded.");
}

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
console.log("[Firebase Client] Initializing DB with ID:", (firebaseConfig as any).firestoreDatabaseId);

let db: any;
try {
  const dbId = (firebaseConfig as any)?.firestoreDatabaseId;
  if (dbId && dbId !== "(default)") {
    console.log("[Firebase Client] Initializing with specific DB ID:", dbId);
    db = firebaseGetFirestore(app, dbId);
  } else {
    db = firebaseGetFirestore(app);
  }
} catch (e) {
  console.warn("[Firebase Client] Failed to get specific Firestore database, attempting initializeFirestore:", e);
  try {
    const dbId = (firebaseConfig as any)?.firestoreDatabaseId;
    db = dbId && dbId !== "(default)" 
      ? initializeFirestore(app, { experimentalForceLongPolling: true }, dbId)
      : initializeFirestore(app, { experimentalForceLongPolling: true });
  } catch (err) {
    const dbId = (firebaseConfig as any)?.firestoreDatabaseId;
    db = dbId && dbId !== "(default)" ? firebaseGetFirestore(app, dbId) : firebaseGetFirestore(app);
  }
}
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();
googleProvider.addScope('https://www.googleapis.com/auth/tasks');
googleProvider.addScope('https://www.googleapis.com/auth/tasks.readonly');
googleProvider.addScope('https://www.googleapis.com/auth/calendar');
googleProvider.addScope('https://www.googleapis.com/auth/calendar.events');
googleProvider.addScope('https://www.googleapis.com/auth/calendar.readonly');
googleProvider.addScope('https://mail.google.com/');
googleProvider.addScope('https://www.googleapis.com/auth/gmail.readonly');
googleProvider.addScope('https://www.googleapis.com/auth/gmail.send');
googleProvider.addScope('https://www.googleapis.com/auth/gmail.modify');
googleProvider.addScope('https://www.googleapis.com/auth/documents');
googleProvider.addScope('https://www.googleapis.com/auth/documents.readonly');
googleProvider.addScope('https://www.googleapis.com/auth/drive.file');

googleProvider.addScope('https://www.googleapis.com/auth/keep');
googleProvider.addScope('https://www.googleapis.com/auth/keep.readonly');
googleProvider.addScope('https://www.googleapis.com/auth/contacts');
googleProvider.addScope('https://www.googleapis.com/auth/contacts.readonly');
googleProvider.addScope('https://www.googleapis.com/auth/chat.messages');
googleProvider.addScope('https://www.googleapis.com/auth/chat.spaces');
googleProvider.addScope('https://www.googleapis.com/auth/drive.metadata.readonly');

// Cache the access token in memory.
export let cachedAccessToken: string | null = null;
export function setCachedAccessToken(token: string | null) {
  cachedAccessToken = token;
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const isNotFound = errorMessage.includes("NOT_FOUND") || errorMessage.includes("code: 5") || errorMessage.includes("Code: 5");
  
  const errInfo: FirestoreErrorInfo = {
    error: isNotFound ? `${errorMessage} (PROVISIONING_REQUIRED: The Firestore database instance might not be provisioned yet.)` : errorMessage,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  
  if (isNotFound) {
    console.warn('[Firebase] Database NOT_FOUND. Please ensure you have provisioned the Firestore database in the Firebase Console.');
    setQuotaExceeded(true); // Trigger local mode fallback if available
  }
  
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export { app, db, auth, googleProvider, signInWithPopup, firebaseSignOut, signInAnonymously, onAuthStateChanged };

export function getFirestore() {
  return db;
}

import { User } from 'firebase/auth';
import {
  collection as realCollection,
  doc as realDoc,
  setDoc as realSetDoc,
  getDoc as realGetDoc,
  addDoc as realAddDoc,
  getDocs as realGetDocs,
  deleteDoc as realDeleteDoc,
  query as realQuery,
  orderBy as realOrderBy,
  limit as realLimit,
  onSnapshot as realOnSnapshot,
  updateDoc as realUpdateDoc,
  where as realWhere
} from "firebase/firestore";

export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to get access token from Firebase Auth');
    }
    
    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Sign in error:', error);
    throw error;
  }
};

export const anonymousSignIn = async (): Promise<{ user: any } | null> => {
  try {
    const result = await signInAnonymously(auth);
    return { user: result.user };
  } catch (error: any) {
    console.warn('[Firebase Auth Fallback] Anonymous sign in failed. This usually means "Anonymous" authentication is not enabled in your Firebase Console (Build > Authentication > Sign-in method). Falling back to offline local sandbox user.', error);
    if (error.message?.includes("auth/admin-restricted-operation")) {
      console.error("ACTION REQUIRED: Enable Anonymous Authentication in the Firebase Console to allow cloud-synced sessions.");
    }
    
    const fallbackUser = {
      uid: "sandbox-local-user",
      email: "sandbox@arcane.local",
      displayName: "Arcane Wanderer (Offline)",
      isAnonymous: true,
      emailVerified: false,
      providerData: [],
      getIdToken: async () => "mock-token",
    };
    
    // Proactively switch to offline fallback mode so we don't attempt to hit the database
    setQuotaExceeded(true);
    return { user: fallbackUser };
  }
};

// --- Firestore Offline / Quota Fallback Shim System ---
export let isQuotaExceeded = false;
try {
  isQuotaExceeded = localStorage.getItem("firestore_quota_exceeded") === "true";
  if (isQuotaExceeded) {
    console.warn("[Firestore Quota Fallback] Proactively loaded quota-exceeded status. Operating in offline storage mode.");
  }
} catch (e) {
  // Local storage disabled or missing
}

export function setQuotaExceeded(val: boolean) {
  isQuotaExceeded = val;
  try {
    if (val) {
      localStorage.setItem("firestore_quota_exceeded", "true");
    } else {
      localStorage.removeItem("firestore_quota_exceeded");
    }
  } catch (e) {}
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
    // Database not found / connection / path errors (e.g. Code: 5 NOT_FOUND)
    code.includes("not-found") ||
    code.includes("not_found") ||
    msg.includes("not_found") ||
    msg.includes("not-found") ||
    msg.includes("database-not-found") ||
    msg.includes("database_not_found") ||
    msg.includes("code: 5") ||
    // Permission / authentication rules issues in Firestore
    code.includes("permission-denied") ||
    msg.includes("permission-denied") ||
    msg.includes("insufficient permissions") ||
    // General connection/grpc offline issues
    msg.includes("grpcconnection rpc 'write'") ||
    msg.includes("grpc")
  );
}

const getOfflineData = (collectionPath: string): any[] => {
  try {
    const data = localStorage.getItem(`offline_db_${collectionPath}`);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    return [];
  }
};

const saveOfflineData = (collectionPath: string, data: any[]) => {
  try {
    localStorage.setItem(`offline_db_${collectionPath}`, JSON.stringify(data));
  } catch (e) {
    console.error("Failed to save offline data:", e);
  }
};

export function collection(firestore: any, ...pathSegments: string[]) {
  const ref = (realCollection as any)(firestore, ...pathSegments);
  const path = pathSegments.join("/");
  (ref as any).__path = path;
  return ref;
}

export function doc(firestore: any, ...pathSegments: string[]) {
  const ref = (realDoc as any)(firestore, ...pathSegments);
  const path = pathSegments.join("/");
  (ref as any).__path = path;
  return ref;
}

export function query(queryRef: any, ...queryConstraints: any[]) {
  const q = (realQuery as any)(queryRef, ...queryConstraints);
  if (queryRef && (queryRef as any).__path) {
    (q as any).__path = (queryRef as any).__path;
  }
  return q;
}

export { realOrderBy as orderBy, realLimit as limit, realWhere as where };

const offlineListeners = new Map<string, Set<(snapshot: any) => void>>();

export function registerOfflineListener(path: string, callback: (snapshot: any) => void) {
  const cleanPath = path.replace(/\//g, "_");
  if (!offlineListeners.has(cleanPath)) {
    offlineListeners.set(cleanPath, new Set());
  }
  offlineListeners.get(cleanPath)!.add(callback);
  return () => {
    const set = offlineListeners.get(cleanPath);
    if (set) {
      set.delete(callback);
      if (set.size === 0) {
        offlineListeners.delete(cleanPath);
      }
    }
  };
}

export function notifyOfflineListeners(path: string) {
  const cleanPath = path.replace(/\//g, "_");
  const listeners = offlineListeners.get(cleanPath);
  if (listeners) {
    const isDoc = path.split("/").length % 2 === 0;
    const snap = isDoc ? handleOfflineGet(path) : handleOfflineGetDocs(path);
    listeners.forEach(cb => {
      try {
        cb(snap);
      } catch (err) {
        console.error("Error in offline listener callback:", err);
      }
    });
  }
}

function handleOfflineAdd(path: string, data: any) {
  const cleanPath = path.replace(/\//g, "_");
  const offlineList = getOfflineData(cleanPath);
  const newId = "offline-" + Math.random().toString(36).substring(2, 15);
  const newDoc = { ...data, id: newId };
  offlineList.push(newDoc);
  saveOfflineData(cleanPath, offlineList);
  notifyOfflineListeners(path);
  
  return {
    id: newId,
    path: `${path}/${newId}`,
    get: async () => ({
      id: newId,
      exists: () => true,
      data: () => data
    })
  };
}

export async function addDoc(reference: any, data: any) {
  const path = reference.__path || reference.path || "";
  if (isQuotaExceeded) {
    return handleOfflineAdd(path, data);
  }
  try {
    return await realAddDoc(reference, data);
  } catch (error: any) {
    if (isQuotaError(error)) {
      setQuotaExceeded(true);
      console.warn(`[Firestore Quota Fallback] Quota exceeded on addDoc for path ${path}. Switching to offline storage.`);
      return handleOfflineAdd(path, data);
    }
    throw error;
  }
}

function handleOfflineSet(path: string, data: any, options?: any) {
  const parts = path.split("/");
  const docId = parts[parts.length - 1];
  const collectionPath = parts.slice(0, -1).join("_");
  const collectionRawPath = parts.slice(0, -1).join("/");
  
  const offlineList = getOfflineData(collectionPath);
  const existingIdx = offlineList.findIndex((item: any) => item.id === docId);
  
  let updatedDoc = { ...data, id: docId };
  if (existingIdx >= 0) {
    if (options?.merge) {
      updatedDoc = { ...offlineList[existingIdx], ...data, id: docId };
    }
    offlineList[existingIdx] = updatedDoc;
  } else {
    offlineList.push(updatedDoc);
  }
  saveOfflineData(collectionPath, offlineList);
  notifyOfflineListeners(collectionRawPath);
  notifyOfflineListeners(path);
}

export async function setDoc(reference: any, data: any, options?: any) {
  const path = reference.__path || reference.path || "";
  if (isQuotaExceeded) {
    return handleOfflineSet(path, data, options);
  }
  try {
    return await realSetDoc(reference, data, options);
  } catch (error: any) {
    if (isQuotaError(error)) {
      setQuotaExceeded(true);
      console.warn(`[Firestore Quota Fallback] Quota exceeded on setDoc for path ${path}. Switching to offline storage.`);
      return handleOfflineSet(path, data, options);
    }
    throw error;
  }
}

export async function updateDoc(reference: any, data: any) {
  const path = reference.__path || reference.path || "";
  if (isQuotaExceeded) {
    return handleOfflineSet(path, data, { merge: true });
  }
  try {
    return await realUpdateDoc(reference, data);
  } catch (error: any) {
    if (isQuotaError(error)) {
      setQuotaExceeded(true);
      console.warn(`[Firestore Quota Fallback] Quota exceeded on updateDoc for path ${path}. Switching to offline storage.`);
      return handleOfflineSet(path, data, { merge: true });
    }
    throw error;
  }
}

function handleOfflineDelete(path: string) {
  const parts = path.split("/");
  const docId = parts[parts.length - 1];
  const collectionPath = parts.slice(0, -1).join("_");
  const collectionRawPath = parts.slice(0, -1).join("/");
  
  const offlineList = getOfflineData(collectionPath);
  const updatedList = offlineList.filter((item: any) => item.id !== docId);
  saveOfflineData(collectionPath, updatedList);
  notifyOfflineListeners(collectionRawPath);
}

export async function deleteDoc(reference: any) {
  const path = reference.__path || reference.path || "";
  if (isQuotaExceeded) {
    return handleOfflineDelete(path);
  }
  try {
    return await realDeleteDoc(reference);
  } catch (error: any) {
    if (isQuotaError(error)) {
      setQuotaExceeded(true);
      console.warn(`[Firestore Quota Fallback] Quota exceeded on deleteDoc for path ${path}. Switching to offline storage.`);
      return handleOfflineDelete(path);
    }
    throw error;
  }
}

function handleOfflineGet(path: string) {
  const parts = path.split("/");
  const docId = parts[parts.length - 1];
  const collectionPath = parts.slice(0, -1).join("_");
  
  const offlineList = getOfflineData(collectionPath);
  const found = offlineList.find((item: any) => item.id === docId);
  
  return {
    id: docId,
    exists: () => !!found,
    data: () => found || null
  };
}

export async function getDoc(reference: any) {
  const path = reference.__path || reference.path || "";
  if (isQuotaExceeded) {
    return handleOfflineGet(path);
  }
  try {
    return await realGetDoc(reference);
  } catch (error: any) {
    if (isQuotaError(error)) {
      setQuotaExceeded(true);
      console.warn(`[Firestore Quota Fallback] Quota exceeded on getDoc for path ${path}. Switching to offline storage.`);
      return handleOfflineGet(path);
    }
    throw error;
  }
}

function handleOfflineGetDocs(path: string) {
  const cleanPath = path.replace(/\//g, "_");
  const offlineList = getOfflineData(cleanPath);
  
  const docs = offlineList.map((item: any) => ({
    id: item.id,
    exists: () => true,
    data: () => item,
    get ref() {
      return doc(db, path, item.id);
    }
  }));
  
  return {
    empty: docs.length === 0,
    size: docs.length,
    docs,
    forEach: (callback: (doc: any) => void) => {
      docs.forEach(callback);
    }
  };
}

export async function getDocs(qOrRef: any) {
  const path = qOrRef?.__path || qOrRef?.path || "";
  if (isQuotaExceeded) {
    return handleOfflineGetDocs(path);
  }
  try {
    return await realGetDocs(qOrRef);
  } catch (error: any) {
    if (isQuotaError(error)) {
      setQuotaExceeded(true);
      console.warn(`[Firestore Quota Fallback] Quota exceeded on getDocs for path ${path}. Switching to offline storage.`);
      return handleOfflineGetDocs(path);
    }
    throw error;
  }
}

export function onSnapshot(qOrRef: any, onNext: (snapshot: any) => void, onError?: (error: any) => void) {
  const path = qOrRef?.__path || qOrRef?.path || "";
  const cleanPath = path.replace(/\//g, "_");
  const isDoc = qOrRef?.type === 'document' || (path && path.split("/").length % 2 === 0);
  
  let isUsingOffline = isQuotaExceeded;
  let realUnsubscribe: (() => void) | null = null;
  let offlineUnsubscribe: (() => void) | null = null;

  function startOffline() {
    isUsingOffline = true;
    if (realUnsubscribe) {
      try { realUnsubscribe(); } catch (e) {}
      realUnsubscribe = null;
    }
    setTimeout(() => {
      onNext(isDoc ? handleOfflineGet(path) : handleOfflineGetDocs(path));
    }, 0);
    offlineUnsubscribe = registerOfflineListener(path, onNext);
  }

  function startOnline() {
    try {
      realUnsubscribe = realOnSnapshot(qOrRef, 
        (snapshot: any) => {
          if (isDoc) {
            try {
              if (snapshot.exists()) {
                const docData = snapshot.data();
                const parts = path.split("/");
                const docId = parts[parts.length - 1];
                const collectionPath = parts.slice(0, -1).join("_");
                const offlineList = getOfflineData(collectionPath);
                const existingIdx = offlineList.findIndex((item: any) => item.id === docId);
                const updatedDoc = { ...docData, id: docId };
                if (existingIdx >= 0) {
                  offlineList[existingIdx] = updatedDoc;
                } else {
                  offlineList.push(updatedDoc);
                }
                saveOfflineData(collectionPath, offlineList);
              }
            } catch (e) {
              console.error("[Firestore Fallback] Failed to cache document snapshot for path:", path, e);
            }
            onNext(snapshot);
          } else {
            try {
              const list: any[] = [];
              snapshot.forEach((doc: any) => {
                list.push({ ...doc.data(), id: doc.id });
              });
              if (list.length > 0) {
                saveOfflineData(cleanPath, list);
              }
            } catch (e) {
              console.error("[Firestore Fallback] Failed to cache snapshot for path:", path, e);
            }
            
            const offlineList = getOfflineData(cleanPath);
            const onlineIds = new Set(snapshot.docs.map((d: any) => d.id));
            const offlineOnly = offlineList.filter((item: any) => !onlineIds.has(item.id));
            
            if (offlineOnly.length > 0) {
              const mergedDocs = [
                ...snapshot.docs.map((d: any) => ({
                  id: d.id,
                  exists: () => true,
                  data: () => d.data(),
                  ref: d.ref
                })),
                ...offlineOnly.map((item: any) => ({
                  id: item.id,
                  exists: () => true,
                  data: () => item,
                  get ref() {
                    return doc(db, path, item.id);
                  }
                }))
              ];
              
              onNext({
                empty: mergedDocs.length === 0,
                size: mergedDocs.length,
                docs: mergedDocs,
                forEach: (callback: (doc: any) => void) => {
                  mergedDocs.forEach(callback);
                }
              });
            } else {
              onNext(snapshot);
            }
          }
        },
        (error: any) => {
          if (isQuotaError(error)) {
            setQuotaExceeded(true);
            console.warn(`[Firestore Quota Fallback] Quota exceeded on onSnapshot for path ${path}. Switching dynamically to offline fallback.`);
            startOffline();
          } else {
            if (onError) onError(error);
          }
        }
      );
    } catch (err: any) {
      if (isQuotaError(err)) {
        setQuotaExceeded(true);
        startOffline();
      } else {
        if (onError) onError(err);
      }
    }
  }

  if (isUsingOffline) {
    startOffline();
  } else {
    startOnline();
  }

  return () => {
    if (realUnsubscribe) {
      try { realUnsubscribe(); } catch (e) {}
    }
    if (offlineUnsubscribe) {
      try { offlineUnsubscribe(); } catch (e) {}
    }
  };
}


