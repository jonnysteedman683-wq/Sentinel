export class CircuitBreaker {
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  failureThreshold: number = 5;
  resetTimeout: number = 30000;
  failureCount: number = 0;
  successes: number = 0;
  lastFailureTime: number = 0;
  successThreshold: number = 3;
  halfOpenMaxRequests: number = 3;

  async call<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.resetTimeout) {
        this.state = 'HALF_OPEN';
        this.successes = 0;
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
    }

    if (this.state === 'HALF_OPEN' && this.successes >= this.halfOpenMaxRequests) {
        throw new Error('Circuit breaker is HALF_OPEN (max requests reached)');
    }

    try {
      const result = await fn();
      this.success();
      return result;
    } catch (err) {
      this.failure();
      throw err;
    }
  }

  getStatus() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successes: this.successes,
      lastFailureTime: this.lastFailureTime
    };
  }

  private success() {
    this.failureCount = 0;
    if (this.state === 'HALF_OPEN') {
        this.successes++;
        if (this.successes >= this.successThreshold) {
            this.state = 'CLOSED';
            this.successes = 0;
        }
    } else {
        this.state = 'CLOSED';
    }
  }

  private failure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    if (this.failureCount >= this.failureThreshold) {
      this.state = 'OPEN';
    }
  }
}
