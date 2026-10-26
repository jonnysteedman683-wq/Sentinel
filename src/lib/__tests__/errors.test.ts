import { describe, it, expect } from 'vitest';
import { parseAPIError, AppError, ErrorCode, AuthError } from '../errors.js';

describe('errors', () => {
  describe('parseAPIError', () => {
    it('returns the same AppError if passed an AppError', () => {
      const err = new AuthError('Test auth error');
      const parsed = parseAPIError(err);
      expect(parsed).toBe(err);
      expect(parsed.code).toBe(ErrorCode.UNAUTHORIZED);
    });

    it('parses an Error containing a stringified JSON AppError envelope', () => {
      const envelope = {
        error: {
          message: 'Parsed JSON message',
          code: ErrorCode.VALIDATION_FAILED,
          traceId: 'trace-123'
        }
      };
      const err = new Error(JSON.stringify(envelope));
      const parsed = parseAPIError(err);

      expect(parsed).toBeInstanceOf(AppError);
      expect(parsed.message).toBe('Parsed JSON message');
      expect(parsed.code).toBe(ErrorCode.VALIDATION_FAILED);
      expect(parsed.traceId).toBe('trace-123');
    });

    it('returns a generic AppError for a standard Error without JSON', () => {
      const err = new Error('Standard error message');
      const parsed = parseAPIError(err);

      expect(parsed).toBeInstanceOf(AppError);
      expect(parsed.message).toBe('Standard error message');
      expect(parsed.code).toBe(ErrorCode.UNKNOWN_ERROR);
    });

    it('parses a string containing a stringified JSON AppError envelope', () => {
      const envelope = {
        error: {
          message: 'Stringified JSON message',
          code: ErrorCode.FIRESTORE_FAILURE,
          traceId: 'trace-456'
        }
      };
      const parsed = parseAPIError(JSON.stringify(envelope));

      expect(parsed).toBeInstanceOf(AppError);
      expect(parsed.message).toBe('Stringified JSON message');
      expect(parsed.code).toBe(ErrorCode.FIRESTORE_FAILURE);
      expect(parsed.traceId).toBe('trace-456');
    });

    it('returns a generic AppError for a standard string', () => {
      const parsed = parseAPIError('Just a standard string');

      expect(parsed).toBeInstanceOf(AppError);
      expect(parsed.message).toBe('Just a standard string');
      expect(parsed.code).toBe(ErrorCode.UNKNOWN_ERROR);
    });

    it('returns a generic AppError for null', () => {
      const parsed = parseAPIError(null);

      expect(parsed).toBeInstanceOf(AppError);
      expect(parsed.message).toBe('An unexpected error occurred');
      expect(parsed.code).toBe(ErrorCode.UNKNOWN_ERROR);
    });

    it('returns a generic AppError for undefined', () => {
      const parsed = parseAPIError(undefined);

      expect(parsed).toBeInstanceOf(AppError);
      expect(parsed.message).toBe('An unexpected error occurred');
      expect(parsed.code).toBe(ErrorCode.UNKNOWN_ERROR);
    });

    it('returns a generic AppError for an arbitrary object', () => {
      const parsed = parseAPIError({ some: 'data' });

      expect(parsed).toBeInstanceOf(AppError);
      expect(parsed.message).toBe('An unexpected error occurred');
      expect(parsed.code).toBe(ErrorCode.UNKNOWN_ERROR);
    });
  });
});
