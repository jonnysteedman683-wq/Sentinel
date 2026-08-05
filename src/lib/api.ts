import { auth, db, collection, query, orderBy, limit, getDocs } from '../firebase.js';
import { AppError, ErrorCode, parseAPIError, ValidationError, AuthError, GeminiAPIError } from './errors.js';

const API_BASE = '/api';

/**
 * Retrieves authorization headers with the current user's Firebase ID token.
 * 
 * @returns {Promise<HeadersInit>} - Mapping of standard authorization headers
 */
async function getAuthHeaders(): Promise<HeadersInit> {
  const token = auth.currentUser ? await auth.currentUser.getIdToken() : '';
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
  if (auth.currentUser?.uid) {
    headers['X-User-Id'] = auth.currentUser.uid;
  }
  return headers;
}

/**
 * High-reliability client-side network fetch wrapper.
 * Automatically injects auth tokens, implements exponential backoff retries 
 * for transient network or 5xx issues, parses standardized error envelopes, 
 * and maps HTTP status codes to specialized AppError subclasses.
 * 
 * @template T - Expected JSON response structure
 * @param {string} endpoint - Relative API route path (e.g. '/chat')
 * @param {RequestInit} [options] - Standard Fetch configuration options
 * @param {number} [maxRetries] - Number of retry attempts for transient failures
 * @returns {Promise<T>} - Parsed typed JSON response
 * @throws {AppError} - Domain-specific mapped application exception
 * @example
 * const data = await apiRequest<{ success: boolean }>('/emotion/estimate', {
 *   method: 'POST',
 *   body: JSON.stringify({ text })
 * });
 */
export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {},
  maxRetries: number = 3
): Promise<T> {
  let attempt = 0;
  const traceId = `client-tr-${Math.random().toString(36).substring(2, 11)}`;

  while (attempt < maxRetries) {
    try {
      const headers = {
        ...(await getAuthHeaders()),
        ...(options.headers || {}),
        'X-Trace-Id': traceId,
      };

      const response = await fetch(`${API_BASE}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`, {
        ...options,
        headers,
      });

      if (response.ok) {
        return (await response.json()) as T;
      }

      // If the response failed, attempt to parse structured error envelope
      let errorBody: any = null;
      try {
        errorBody = await response.json();
      } catch {
        // Response was not JSON
      }

      const message = errorBody?.error?.message || `API request failed with status ${response.status}`;
      const code = errorBody?.error?.code || ErrorCode.UNKNOWN_ERROR;

      // Handle specific HTTP status codes
      if (response.status === 401) {
        throw new AuthError(message, traceId);
      }
      if (response.status === 400) {
        throw new ValidationError(message, traceId);
      }
      if (response.status === 502) {
        throw new GeminiAPIError(message, traceId);
      }

      // Transient errors that we can retry
      if ([502, 503, 504].includes(response.status) && attempt < maxRetries - 1) {
        throw new Error(`Transient status code ${response.status}`);
      }

      throw new AppError(message, code as ErrorCode, response.status, traceId);

    } catch (error: any) {
      attempt++;
      const isTransient = error.message?.includes('Transient') || !window.navigator.onLine;

      if (isTransient && attempt < maxRetries) {
        const delay = 150 * attempt * attempt; // Exponential backoff: 150ms, 600ms, 1350ms
        console.warn(`[API Client Retry] Attempt ${attempt} failed. Retrying in ${delay}ms...`, error);
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      // Log error to console and telemetry if it's the final failure
      console.error(`[API Client Error] Request to ${endpoint} failed permanently on attempt ${attempt}:`, error);
      
      // Prevent infinite telemetry loops
      if (endpoint !== '/ingest-telemetry') {
        ingestTelemetry({
          type: 'API_CLIENT_ERROR',
          data: {
            endpoint,
            attempt,
            message: error.message,
            code: (error as any).code || 'CLIENT_EXCEPTION',
            traceId,
          }
        }).catch(() => {});
      }

      throw parseAPIError(error);
    }
  }

  throw new AppError('Request failed due to excessive retries', ErrorCode.NETWORK_ERROR, 500, traceId);
}

export interface Memory {
  id: string;
  text: string;
  timestamp: number;
  strength: number;
  tags?: string[];
  pinned?: boolean;
}

export interface ConsolidationProposal {
  chatId: string;
  summary: string;
  tags: string[];
  confidence: number;
}

export interface InsightData {
  insight: string;
  sources: string[];
  confidence: number;
}

export async function fetchInsight(): Promise<InsightData | null> {
  const data = await apiRequest<{ insight: InsightData | null }>('/generate-insight', {
    method: 'POST',
  });
  return data.insight || null;
}

export async function saveInsightMemory(insight: InsightData): Promise<string> {
  const data = await apiRequest<{ memoryId: string }>('/confirm-memory', {
    method: 'POST',
    body: JSON.stringify({
      chatId: null,
      summary: insight.insight,
      tags: ['insight'],
      confidence: insight.confidence,
      sourceIds: insight.sources,
      type: 'insight',
      pinned: true,
    }),
  });
  return data.memoryId;
}

export async function referenceInsight(insightMemoryId: string): Promise<void> {
  await apiRequest<void>('/reference-insight', {
    method: 'POST',
    body: JSON.stringify({ insightMemoryId }),
  });
}

export async function fetchNudgeMemory(localMemories?: Memory[]): Promise<Memory | null> {
  try {
    const body = localMemories ? JSON.stringify({ memories: localMemories }) : undefined;
    const method = localMemories ? 'POST' : 'GET';

    const data = await apiRequest<{ memory: Memory | null }>('/nudge-memory', {
      method,
      body,
    });
    return data.memory || null;
  } catch (error) {
    console.warn('fetchNudgeMemory permanently failed, attempting local fallback:', error);
    // Client-side fallback if server failed permanently
    if (localMemories && localMemories.length > 0) {
      const pinned = localMemories.filter(m => m.pinned);
      if (pinned.length > 0) {
        pinned.sort((a, b) => b.strength - a.strength);
        return pinned[0];
      }
      const sorted = [...localMemories].sort((a, b) => b.timestamp - a.timestamp);
      return sorted[0];
    }
    return null;
  }
}

export async function logSystemEvent(params: {
  type: string;
  memoryId?: string;
  engagement?: string;
  payload?: any;
  traceId?: string;
}): Promise<void> {
  try {
    await apiRequest<void>('/log-system-event', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  } catch (error) {
    console.error('logSystemEvent failed:', error);
  }
}

export async function ingestTelemetry(params: {
  type: string;
  data: any;
}): Promise<void> {
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (auth.currentUser) {
      headers['Authorization'] = `Bearer ${await auth.currentUser.getIdToken()}`;
    }

    await fetch(`${API_BASE}/ingest-telemetry`, {
      method: 'POST',
      headers,
      body: JSON.stringify(params),
    });
  } catch (error) {
    console.error('ingestTelemetry failed:', error);
  }
}

export async function fetchConsolidationProposal(chatId: string): Promise<ConsolidationProposal | null> {
  const data = await apiRequest<{ proposal: ConsolidationProposal | null }>('/consolidate-chat', {
    method: 'POST',
    body: JSON.stringify({ chatId }),
  });
  return data.proposal || null;
}

export async function confirmMemory(proposal: ConsolidationProposal): Promise<void> {
  await apiRequest<void>('/confirm-memory', {
    method: 'POST',
    body: JSON.stringify({
      chatId: proposal.chatId,
      summary: proposal.summary,
      tags: proposal.tags,
      confidence: proposal.confidence,
    }),
  });
}

export async function getLatestUnconsolidatedChatId(): Promise<string | null> {
  const uid = auth.currentUser?.uid;
  if (!uid) return null;
  const chatsRef = collection(db, `users/${uid}/chats`);
  const q = query(chatsRef, orderBy('timestamp', 'desc'), limit(30));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const unconsolidatedDoc = snap.docs.find(doc => doc.data().consolidated !== true);
  return unconsolidatedDoc ? unconsolidatedDoc.id : null;
}
