export type CircuitBreakerState = 'closed' | 'open' | 'half-open';

export interface CircuitBreakerOptions {
  failureThreshold?: number;
  recoveryTimeoutMs?: number;
}

export class CircuitBreaker {
  private failureThreshold: number;
  private recoveryTimeoutMs: number;
  private failureCount = 0;
  private lastFailureTime?: number;
  private state: CircuitBreakerState = 'closed';

  constructor(options: CircuitBreakerOptions = {}) {
    this.failureThreshold = options.failureThreshold ?? 3;
    this.recoveryTimeoutMs = options.recoveryTimeoutMs ?? 30_000;
  }

  getState(): CircuitBreakerState {
    if (this.state === 'open') {
      if (this.lastFailureTime && Date.now() - this.lastFailureTime >= this.recoveryTimeoutMs) {
        this.state = 'half-open';
      }
    }
    return this.state;
  }

  isOpen(): boolean {
    return this.getState() === 'open';
  }

  recordSuccess(): void {
    this.failureCount = 0;
    this.state = 'closed';
    this.lastFailureTime = undefined;
  }

  recordFailure(): void {
    this.failureCount += 1;
    this.lastFailureTime = Date.now();
    if (this.failureCount >= this.failureThreshold) {
      this.state = 'open';
    }
  }
}
