export interface CircuitBreakerOptions {
  name: string;
  failureThreshold: number;
  resetTimeoutMs: number;
  now?: () => number;
}

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export class CircuitOpenError extends Error {
  readonly circuit: string;

  constructor(circuit: string, retryAfterMs: number) {
    super(`Circuito '${circuit}' aberto — pedido recusado sem chamar o serviço a montante`);
    this.name = 'CircuitOpenError';
    this.circuit = circuit;
    this.retryAfterMs = retryAfterMs;
  }

  readonly retryAfterMs: number;
}

export class CircuitBreaker {
  private failures = 0;
  private openedAt: number | null = null;
  private readonly now: () => number;

  constructor(private options: CircuitBreakerOptions) {
    this.now = options.now ?? Date.now;
  }

  get state(): CircuitState {
    if (this.openedAt === null) {
      return 'CLOSED';
    }
    return this.now() - this.openedAt >= this.options.resetTimeoutMs ? 'HALF_OPEN' : 'OPEN';
  }

  get failureCount(): number {
    return this.failures;
  }

  assertCallable(): void {
    if (this.state === 'OPEN') {
      const elapsed = this.now() - (this.openedAt as number);
      throw new CircuitOpenError(this.options.name, Math.max(0, this.options.resetTimeoutMs - elapsed));
    }
  }

  onSuccess(): void {
    this.failures = 0;
    this.openedAt = null;
  }

  onFailure(): void {
    if (this.state === 'HALF_OPEN') {
      this.openedAt = this.now();
      this.failures = this.options.failureThreshold;
      return;
    }
    this.failures += 1;
    if (this.failures >= this.options.failureThreshold) {
      this.openedAt = this.now();
    }
  }

  snapshot(): { name: string; state: CircuitState; failures: number } {
    return { name: this.options.name, state: this.state, failures: this.failures };
  }
}

export interface RetryOptions {
  attempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  sleep?: (ms: number) => Promise<void>;
  shouldRetry?: (error: unknown, attempt: number) => boolean;
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function withRetry<T>(operation: (attempt: number) => Promise<T>, options: RetryOptions): Promise<T> {
  const sleep = options.sleep ?? defaultSleep;
  const attempts = Math.max(1, options.attempts);
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation(attempt);
    } catch (error) {
      lastError = error;
      const retryable = options.shouldRetry ? options.shouldRetry(error, attempt) : true;
      if (!retryable || attempt === attempts) {
        break;
      }
      const delay = Math.min(options.maxDelayMs, options.baseDelayMs * 2 ** (attempt - 1));
      await sleep(delay);
    }
  }

  throw lastError;
}

export interface TtlCacheOptions<T> {
  ttlMs: number;
  now?: () => number;
  load: () => Promise<T>;
  onError?: (error: unknown, cached: T | undefined) => T | undefined | Promise<T | undefined>;
}

export class TtlCache<T> {
  private cached: { value: T; expiresAt: number } | null = null;
  private inflight: Promise<T> | null = null;
  private readonly now: () => number;

  constructor(private options: TtlCacheOptions<T>) {
    this.now = options.now ?? Date.now;
  }

  get cachedValue(): T | undefined {
    return this.cached && this.cached.expiresAt > this.now() ? this.cached.value : undefined;
  }

  invalidate(): void {
    this.cached = null;
  }

  async get(): Promise<T> {
    const fresh = this.cachedValue;
    if (fresh !== undefined) {
      return fresh;
    }
    if (this.inflight) {
      return this.inflight;
    }

    const pending = (async () => {
      try {
        const value = await this.options.load();
        this.cached = { value, expiresAt: this.now() + this.options.ttlMs };
        return value;
      } catch (error) {
        const fallback = await this.options.onError?.(error, this.cached?.value);
        if (fallback !== undefined) {
          return fallback;
        }
        throw error;
      } finally {
        this.inflight = null;
      }
    })();

    this.inflight = pending;
    return pending;
  }
}