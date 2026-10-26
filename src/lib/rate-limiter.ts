import { Request, Response, NextFunction } from 'express';

interface TokenBucket {
  tokens: number;
  lastRefill: number;
}

interface RateLimiterConfig {
  /** Maximum tokens per bucket (requests allowed per window) */
  maxTokens: number;
  /** Refill rate in tokens per second */
  refillRate: number;
  /** Cleanup interval in ms for expired entries */
  cleanupIntervalMs: number;
}

const TIER_CONFIGS: Record<string, RateLimiterConfig> = {
  heavy: { maxTokens: 30, refillRate: 0.5, cleanupIntervalMs: 300_000 },     // 30 req burst, ~30/min sustained
  standard: { maxTokens: 100, refillRate: 1.67, cleanupIntervalMs: 300_000 }, // 100 req burst, ~100/min sustained
  light: { maxTokens: 300, refillRate: 5.0, cleanupIntervalMs: 300_000 },     // 300 req burst, ~300/min sustained
};

const HEAVY_ROUTES = ['/api/chat', '/api/debate', '/api/knowledge/erd', '/api/swarm'];
const LIGHT_ROUTES = ['/api/system/health', '/api/debug/diagnostics', '/api/debug/quota-status'];

function getTier(path: string): 'heavy' | 'standard' | 'light' {
  if (HEAVY_ROUTES.some(r => path.startsWith(r))) return 'heavy';
  if (LIGHT_ROUTES.some(r => path.startsWith(r))) return 'light';
  return 'standard';
}

function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
  return req.socket?.remoteAddress || 'unknown';
}

/** Per-tier, per-IP token bucket stores */
const buckets: Record<string, Map<string, TokenBucket>> = {
  heavy: new Map(),
  standard: new Map(),
  light: new Map(),
};

function refillBucket(bucket: TokenBucket, config: RateLimiterConfig): void {
  const now = Date.now();
  const elapsed = (now - bucket.lastRefill) / 1000;
  bucket.tokens = Math.min(config.maxTokens, bucket.tokens + elapsed * config.refillRate);
  bucket.lastRefill = now;
}

/** Prune entries that have been fully refilled and idle for >5 minutes */
function cleanupBuckets(): void {
  const now = Date.now();
  for (const tier of Object.keys(buckets)) {
    const map = buckets[tier];
    const config = TIER_CONFIGS[tier];
    for (const [ip, bucket] of map.entries()) {
      if (now - bucket.lastRefill > config.cleanupIntervalMs && bucket.tokens >= config.maxTokens) {
        map.delete(ip);
      }
    }
  }
}

// Run cleanup every 5 minutes
let _cleanupTimer: ReturnType<typeof setInterval> | null = null;

export function startRateLimiterCleanup(): void {
  if (!_cleanupTimer) {
    _cleanupTimer = setInterval(cleanupBuckets, 300_000);
    // Allow the process to exit even if this timer is still running
    if (_cleanupTimer && typeof _cleanupTimer === 'object' && 'unref' in _cleanupTimer) {
      _cleanupTimer.unref();
    }
  }
}

export function stopRateLimiterCleanup(): void {
  if (_cleanupTimer) {
    clearInterval(_cleanupTimer);
    _cleanupTimer = null;
  }
}

/**
 * Express middleware that enforces per-IP, tiered token-bucket rate limiting
 * on all /api/ routes.
 */
export function rateLimiterMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Only rate-limit API routes
  if (!req.url.startsWith('/api/')) {
    next();
    return;
  }

  const tier = getTier(req.url);
  const config = TIER_CONFIGS[tier];
  const ip = getClientIp(req);
  const map = buckets[tier];

  let bucket = map.get(ip);
  if (!bucket) {
    bucket = { tokens: config.maxTokens, lastRefill: Date.now() };
    map.set(ip, bucket);
  }

  refillBucket(bucket, config);

  if (bucket.tokens < 1) {
    const retryAfter = Math.ceil((1 - bucket.tokens) / config.refillRate);
    res.set('Retry-After', String(retryAfter));
    res.set('X-RateLimit-Remaining', '0');
    res.status(429).json({
      error: 'Too many requests. Please slow down.',
      retryAfterSeconds: retryAfter,
    });
    return;
  }

  bucket.tokens -= 1;
  res.set('X-RateLimit-Remaining', String(Math.floor(bucket.tokens)));
  next();
}
