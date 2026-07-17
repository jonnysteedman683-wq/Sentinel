import { Request, Response, NextFunction, RequestHandler } from 'express';
import { CircuitBreaker } from './resilience.js';
import { AppError, ErrorCode } from './errors.js';

const breakers = new Map<string, CircuitBreaker>();

export function withResilience(routeId: string, handler: RequestHandler): RequestHandler {
  if (!breakers.has(routeId)) {
    breakers.set(routeId, new CircuitBreaker());
  }
  const breaker = breakers.get(routeId)!;

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await breaker.call(async () => {
        await Promise.resolve(handler(req, res, next));
      });
    } catch (err: any) {
      if (err.message?.includes('Circuit breaker is OPEN') || err.message?.includes('HALF_OPEN')) {
         next(new AppError('Service temporarily unavailable due to high failure rate.', ErrorCode.CIRCUIT_BREAK_ACTIVE, 503));
      } else {
         next(err);
      }
    }
  };
}

export function asyncHandler(fn: RequestHandler): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
