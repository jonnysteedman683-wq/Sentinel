/**
 * Server-side identity: the only trusted source of a user's uid is a Firebase
 * ID token whose signature, audience, issuer and expiry have been verified.
 *
 * Never read a uid from the request body, query string, or an unverified JWT
 * payload: those are attacker-controlled and allowed anyone to act as any user.
 *
 * Verification uses firebase-admin with only the project ID. It checks the token
 * against Google's public signing keys, so no service-account key is needed.
 */

import fs from 'node:fs';
import path from 'node:path';
import { type App, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

export type TokenVerifier = (idToken: string) => Promise<{ uid: string }>;

const APP_NAME = 'sentinel-auth';
let verifierOverride: TokenVerifier | null = null;
let cachedVerifier: TokenVerifier | null = null;

export function resolveProjectId(): string | undefined {
  const fromEnv = process.env.FIREBASE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT;
  if (fromEnv?.trim()) return fromEnv.trim();
  try {
    const raw = fs.readFileSync(path.join(process.cwd(), 'firebase-applet-config.json'), 'utf8');
    const projectId = JSON.parse(raw)?.projectId;
    return typeof projectId === 'string' && projectId ? projectId : undefined;
  } catch {
    return undefined;
  }
}

function defaultVerifier(): TokenVerifier | null {
  if (cachedVerifier) return cachedVerifier;
  const projectId = resolveProjectId();
  if (!projectId) return null;
  const existing = getApps().find((a) => a.name === APP_NAME);
  const app: App = existing ?? initializeApp({ projectId }, APP_NAME);
  const auth = getAuth(app);
  cachedVerifier = async (idToken: string) => {
    const decoded = await auth.verifyIdToken(idToken);
    return { uid: decoded.uid };
  };
  return cachedVerifier;
}

/** Test hook: replace token verification (pass null to restore the real verifier). */
export function setTokenVerifierForTests(verifier: TokenVerifier | null): void {
  verifierOverride = verifier;
}

export function extractBearerToken(header: unknown): string | null {
  if (typeof header !== 'string') return null;
  const match = /^Bearer\s+(\S+)\s*$/i.exec(header);
  return match ? match[1] : null;
}

/**
 * Returns the verified uid for an Authorization header, or null when the header
 * is missing, malformed, expired, forged, or verification is unavailable.
 */
export async function verifyAuthorizationHeader(header: unknown): Promise<string | null> {
  const token = extractBearerToken(header);
  if (!token) return null;
  const verifier = verifierOverride ?? defaultVerifier();
  if (!verifier) return null; // fail closed: no project ID, no identity
  try {
    const { uid } = await verifier(token);
    return typeof uid === 'string' && uid ? uid : null;
  } catch {
    return null;
  }
}

/**
 * Express middleware: sets req.user = { uid } only for a verified token, else null.
 * Downstream code reads identity exclusively from req.user.
 */
export function authenticateRequest() {
  return async (req: any, _res: any, next: (err?: unknown) => void) => {
    try {
      const uid = await verifyAuthorizationHeader(req.headers?.authorization);
      req.user = uid ? { uid } : null;
    } catch {
      req.user = null;
    }
    next();
  };
}
