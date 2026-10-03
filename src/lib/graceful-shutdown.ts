import type { Server } from 'http';
import { stopRateLimiterCleanup } from './rate-limiter.js';

interface ShutdownTarget {
  stop?: () => void;
}

/**
 * Registers SIGTERM/SIGINT handlers for graceful server shutdown.
 * 
 * On signal:
 * 1. Stops accepting new connections
 * 2. Stops the SelfHealingOrchestrator (if provided)
 * 3. Stops the rate limiter cleanup timer
 * 4. Waits for in-flight requests to drain (up to timeoutMs)
 * 5. Force-exits if connections won't close
 */
export function registerShutdownHooks(
  server: Server,
  orchestrator?: ShutdownTarget | null,
  timeoutMs: number = 10_000
): void {
  let isShuttingDown = false;

  const shutdown = (signal: string) => {
    if (isShuttingDown) return;
    isShuttingDown = true;

    console.log(`\n[Shutdown] Received ${signal}. Starting graceful shutdown...`);

    // Stop accepting new connections
    server.close((err) => {
      if (err) {
        console.error('[Shutdown] Error closing server:', err.message);
      } else {
        console.log('[Shutdown] Server closed. All connections drained.');
      }

      cleanup();
      process.exit(err ? 1 : 0);
    });

    // Force-exit after timeout
    const forceTimer = setTimeout(() => {
      console.error(`[Shutdown] Forced exit after ${timeoutMs}ms timeout. Some connections may not have drained.`);
      cleanup();
      process.exit(1);
    }, timeoutMs);

    // Allow the process to exit even if this timer is still running
    if (forceTimer && typeof forceTimer === 'object' && 'unref' in forceTimer) {
      forceTimer.unref();
    }
  };

  const cleanup = () => {
    // Stop the self-healing orchestrator
    if (orchestrator?.stop) {
      try {
        orchestrator.stop();
        console.log('[Shutdown] SelfHealingOrchestrator stopped.');
      } catch (e) {
        console.error('[Shutdown] Error stopping orchestrator:', e);
      }
    }

    // Stop the rate limiter cleanup interval
    try {
      stopRateLimiterCleanup();
      console.log('[Shutdown] Rate limiter cleanup stopped.');
    } catch (e) {
      console.error('[Shutdown] Error stopping rate limiter:', e);
    }
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  console.log('[Shutdown] Graceful shutdown hooks registered (SIGTERM, SIGINT).');
}
