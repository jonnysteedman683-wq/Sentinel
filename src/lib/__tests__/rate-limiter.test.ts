import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { rateLimiterMiddleware, startRateLimiterCleanup, stopRateLimiterCleanup } from '../rate-limiter.js';
import { Request, Response, NextFunction } from 'express';

describe('rateLimiter', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;
  let testIpCounter = 1;

  beforeEach(() => {
    req = {
      url: '/api/test',
      headers: {},
      socket: { remoteAddress: `10.0.0.${testIpCounter++}` } as any
    };
    res = {
      set: vi.fn(),
      status: vi.fn().mockReturnThis(),
      json: vi.fn()
    };
    next = vi.fn();
    vi.useFakeTimers();
    // Ensure Date.now() starts at a predictable time, not 0 to avoid edge cases
    vi.setSystemTime(new Date(2023, 0, 1, 12, 0, 0).getTime());
  });

  afterEach(() => {
    vi.useRealTimers();
    stopRateLimiterCleanup();
  });

  describe('rateLimiterMiddleware', () => {
    it('bypasses non-/api/ routes', () => {
      req.url = '/static/app.js';
      rateLimiterMiddleware(req as Request, res as Response, next);
      expect(next).toHaveBeenCalledTimes(1);
      expect(res.set).not.toHaveBeenCalled();
    });

    it('applies standard rate limiting correctly', () => {
      req.url = '/api/some/endpoint'; // standard tier: 100 max

      // First request
      rateLimiterMiddleware(req as Request, res as Response, next);
      expect(next).toHaveBeenCalledTimes(1);
      expect(res.set).toHaveBeenCalledWith('X-RateLimit-Remaining', '99');

      // Burn through remaining 99 standard tokens
      for (let i = 0; i < 99; i++) {
        rateLimiterMiddleware(req as Request, res as Response, next);
      }
      expect(next).toHaveBeenCalledTimes(100);

      // Now we should be out of tokens
      rateLimiterMiddleware(req as Request, res as Response, next);
      expect(res.status).toHaveBeenCalledWith(429);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.any(String) }));
      expect(res.set).toHaveBeenCalledWith('Retry-After', expect.any(String));
      expect(res.set).toHaveBeenCalledWith('X-RateLimit-Remaining', '0');
    });

    it('differentiates heavy and light routes', () => {
      // heavy route: '/api/chat', maxTokens = 30
      req.url = '/api/chat/messages';
      rateLimiterMiddleware(req as Request, res as Response, next);
      expect(res.set).toHaveBeenCalledWith('X-RateLimit-Remaining', '29');

      // Different IP for the light route so it doesn't share state
      Object.defineProperty(req.socket, 'remoteAddress', { value: `10.0.0.${testIpCounter++}`, writable: true });
      // light route: '/api/system/health', maxTokens = 300
      req.url = '/api/system/health';
      rateLimiterMiddleware(req as Request, res as Response, next);
      expect(res.set).toHaveBeenCalledWith('X-RateLimit-Remaining', '299');
    });

    it('refills tokens over time', () => {
      req.url = '/api/debate'; // heavy tier, 30 max, 0.5/s

      // Use up 10 tokens
      for (let i = 0; i < 10; i++) {
        rateLimiterMiddleware(req as Request, res as Response, next);
      }
      expect(res.set).toHaveBeenLastCalledWith('X-RateLimit-Remaining', '20');

      // Advance time by 4 seconds (should replenish 4 * 0.5 = 2 tokens)
      vi.advanceTimersByTime(4000);

      rateLimiterMiddleware(req as Request, res as Response, next);
      // It had 20, replenished 2 -> 22, then used 1 -> 21
      expect(res.set).toHaveBeenLastCalledWith('X-RateLimit-Remaining', '21');
    });

    it('gets IP from x-forwarded-for header if present', () => {
      req.headers!['x-forwarded-for'] = '192.168.1.100, 10.0.0.1';
      req.url = '/api/test2';

      rateLimiterMiddleware(req as Request, res as Response, next);
      expect(res.set).toHaveBeenLastCalledWith('X-RateLimit-Remaining', '99');

      // Test without header, uses socket remoteAddress
      req.headers = {};
      req.url = '/api/test3';
      rateLimiterMiddleware(req as Request, res as Response, next);
      Object.defineProperty(req.socket, 'remoteAddress', { value: `10.0.0.${testIpCounter++}`, writable: true });
      expect(res.set).toHaveBeenLastCalledWith('X-RateLimit-Remaining', '99');
    });
  });

  describe('cleanup functionality', () => {
    it('prunes idle buckets', () => {
      startRateLimiterCleanup();

      req.url = '/api/standard';
      rateLimiterMiddleware(req as Request, res as Response, next);

      // Fully replenish and idle for > 5 minutes
      vi.advanceTimersByTime(6 * 60 * 1000);

      // Since timer fired, the old bucket should be gone.
      // Another request should recreate it from scratch.
      rateLimiterMiddleware(req as Request, res as Response, next);
      expect(res.set).toHaveBeenLastCalledWith('X-RateLimit-Remaining', '99');
    });

    it('stops cleanup timer', () => {
      startRateLimiterCleanup();
      stopRateLimiterCleanup();

      req.url = '/api/standard2';
      rateLimiterMiddleware(req as Request, res as Response, next);

      // Advance by 10 minutes, shouldn't crash if timer is stopped
      vi.advanceTimersByTime(10 * 60 * 1000);

      rateLimiterMiddleware(req as Request, res as Response, next);
      expect(res.set).toHaveBeenLastCalledWith('X-RateLimit-Remaining', '99');
    });
  });
});
