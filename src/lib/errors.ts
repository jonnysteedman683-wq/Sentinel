/**
 * @file errors.ts
 * @description Robust, multi-tier full-stack error handling framework for Arcane Quantum Brain.
 * This handles parsing, logging, class representation, and telemetry integration.
 */

export enum ErrorCode {
  UNAUTHORIZED = 'UNAUTHORIZED',
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  GEMINI_API_FAILURE = 'GEMINI_API_FAILURE',
  FIRESTORE_FAILURE = 'FIRESTORE_FAILURE',
  CIRCUIT_BREAK_ACTIVE = 'CIRCUIT_BREAK_ACTIVE',
  NETWORK_ERROR = 'NETWORK_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

/**
 * Custom base application error class.
 * All domain-specific errors should inherit from this.
 */
export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly status: number;
  public readonly traceId?: string;
  public readonly timestamp: number;

  /**
   * @param {string} message - Descriptive error message
   * @param {ErrorCode} code - Enum categorization of the error
   * @param {number} status - HTTP status code mapping
   * @param {string} [traceId] - Unique ID for tracing the request across frontend/backend boundaries
   */
  constructor(message: string, code: ErrorCode = ErrorCode.UNKNOWN_ERROR, status: number = 500, traceId?: string) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.status = status;
    this.traceId = traceId;
    this.timestamp = Date.now();
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Represents authentication or authorization failures.
 */
export class AuthError extends AppError {
  constructor(message: string = 'Access denied: Authentication required', traceId?: string) {
    super(message, ErrorCode.UNAUTHORIZED, 401, traceId);
  }
}

/**
 * Represents validation or parsing failures of inputs/payloads.
 */
export class ValidationError extends AppError {
  constructor(message: string, traceId?: string) {
    super(message, ErrorCode.VALIDATION_FAILED, 400, traceId);
  }
}

/**
 * Represents issues with Gemini model API calls or content generation.
 */
export class GeminiAPIError extends AppError {
  constructor(message: string, traceId?: string) {
    super(message, ErrorCode.GEMINI_API_FAILURE, 502, traceId);
  }
}

/**
 * Represents issues with Firebase / Firestore database operations or permissions.
 */
export class FirestoreError extends AppError {
  constructor(message: string, traceId?: string) {
    super(message, ErrorCode.FIRESTORE_FAILURE, 500, traceId);
  }
}

/**
 * Standard server response body envelope for structured errors.
 */
export interface ErrorResponseEnvelope {
  error: {
    message: string;
    code: ErrorCode;
    traceId?: string;
    timestamp: number;
    stack?: string;
  };
}

/**
 * Parses any unknown error value into a structured description.
 * Useful for catching server response errors or browser exceptions.
 * 
 * @param {unknown} error - The caught raw error object/string/value
 * @returns {AppError} - Normalized AppError instance
 * @example
 * try { ... } catch (err) {
 *   const normalized = parseAPIError(err);
 *   console.error(normalized.message, normalized.code);
 * }
 */
export function parseAPIError(error: unknown): AppError {
  if (error instanceof AppError) {
    return error;
  }

  if (error instanceof Error) {
    // If the error contains stringified JSON of our error envelope
    try {
      const parsed = JSON.parse(error.message);
      if (parsed && parsed.error) {
        return new AppError(
          parsed.error.message,
          parsed.error.code as ErrorCode,
          500,
          parsed.error.traceId
        );
      }
    } catch {
      // Not JSON, fall through
    }

    return new AppError(error.message, ErrorCode.UNKNOWN_ERROR, 500);
  }

  if (typeof error === 'string') {
    try {
      const parsed = JSON.parse(error);
      if (parsed && parsed.error) {
        return new AppError(
          parsed.error.message,
          parsed.error.code as ErrorCode,
          500,
          parsed.error.traceId
        );
      }
    } catch {
      // Not JSON
    }
    return new AppError(error, ErrorCode.UNKNOWN_ERROR, 500);
  }

  return new AppError('An unexpected error occurred', ErrorCode.UNKNOWN_ERROR, 500);
}
