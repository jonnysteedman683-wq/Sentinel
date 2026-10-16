import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  authenticateRequest,
  extractBearerToken,
  setTokenVerifierForTests,
  verifyAuthorizationHeader,
} from '../auth.js';

function b64url(value: object): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

/** A JWT-shaped token with a uid claim but no valid signature. */
const FORGED_TOKEN = `${b64url({ alg: 'none', typ: 'JWT' })}.${b64url({ uid: 'victim-uid', user_id: 'victim-uid' })}.`;

async function runMiddleware(req: any) {
  const next = vi.fn();
  await authenticateRequest()(req, {}, next);
  expect(next).toHaveBeenCalledOnce();
  return req.user;
}

afterEach(() => {
  setTokenVerifierForTests(null);
  vi.unstubAllEnvs();
});

describe('extractBearerToken', () => {
  it('accepts only a single bearer token', () => {
    expect(extractBearerToken('Bearer abc.def.ghi')).toBe('abc.def.ghi');
    expect(extractBearerToken('bearer abc')).toBe('abc');
    expect(extractBearerToken('Bearer ')).toBeNull();
    expect(extractBearerToken('Basic abc')).toBeNull();
    expect(extractBearerToken('Bearer a b')).toBeNull();
    expect(extractBearerToken(undefined)).toBeNull();
    expect(extractBearerToken(['Bearer a'])).toBeNull();
  });
});

describe('verifyAuthorizationHeader', () => {
  it('returns the uid from a token the verifier accepts', async () => {
    setTokenVerifierForTests(async (token) => {
      expect(token).toBe('good-token');
      return { uid: 'real-user' };
    });
    expect(await verifyAuthorizationHeader('Bearer good-token')).toBe('real-user');
  });

  it('returns null when the verifier rejects the token', async () => {
    setTokenVerifierForTests(async () => {
      throw new Error('signature invalid');
    });
    expect(await verifyAuthorizationHeader(`Bearer ${FORGED_TOKEN}`)).toBeNull();
  });

  it('rejects an unsigned token with the real firebase-admin verifier', async () => {
    vi.stubEnv('FIREBASE_PROJECT_ID', 'sentinel-unit-test-project');
    expect(await verifyAuthorizationHeader(`Bearer ${FORGED_TOKEN}`)).toBeNull();
  });

  it('returns null for an empty uid from the verifier', async () => {
    setTokenVerifierForTests(async () => ({ uid: '' }));
    expect(await verifyAuthorizationHeader('Bearer x')).toBeNull();
  });
});

describe('authenticateRequest middleware', () => {
  it('never takes identity from the body or query string', async () => {
    setTokenVerifierForTests(async () => {
      throw new Error('should not be called without a bearer token');
    });
    const user = await runMiddleware({
      headers: {},
      body: { uid: 'victim-uid' },
      query: { uid: 'victim-uid' },
    });
    expect(user).toBeNull();
  });

  it('ignores an unverified JWT payload even with a body uid present', async () => {
    setTokenVerifierForTests(async () => {
      throw new Error('signature invalid');
    });
    const user = await runMiddleware({
      headers: { authorization: `Bearer ${FORGED_TOKEN}` },
      body: { uid: 'victim-uid' },
    });
    expect(user).toBeNull();
  });

  it('sets req.user from a verified token and ignores a conflicting body uid', async () => {
    setTokenVerifierForTests(async () => ({ uid: 'real-user' }));
    const user = await runMiddleware({
      headers: { authorization: 'Bearer good-token' },
      body: { uid: 'victim-uid' },
    });
    expect(user).toEqual({ uid: 'real-user' });
  });
});
