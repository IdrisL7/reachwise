/**
 * Performance utilities for GetSignalHooks
 * Provides timeout management, circuit breaker, and performance monitoring
 */

export interface TimeoutConfig {
  timeout: number;
  retries?: number;
  retryDelay?: number;
}

export class TimeoutError extends Error {
  constructor(operation: string, timeout: number) {
    super(`Operation '${operation}' timed out after ${timeout}ms`);
    this.name = 'TimeoutError';
  }
}

/**
 * Wraps any async operation with timeout and optional retries
 */
export async function withTimeout<T>(
  operation: () => Promise<T>,
  config: TimeoutConfig,
  operationName = 'operation'
): Promise<T> {
  const { timeout, retries = 0, retryDelay = 1000 } = config;
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    try {
      const result = await Promise.race([
        operation(),
        new Promise<never>((_, reject) => {
          controller.signal.addEventListener('abort', () => {
            reject(new TimeoutError(operationName, timeout));
          });
        })
      ]);
      
      clearTimeout(timeoutId);
      return result;
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (attempt < retries && !(error instanceof TimeoutError)) {
        console.warn(`${operationName} failed (attempt ${attempt + 1}/${retries + 1}):`, error);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        continue;
      }
      
      throw error;
    }
  }
  
  throw new Error(`All retry attempts failed for ${operationName}`);
}

/**
 * Simple circuit breaker for external API calls
 */
class CircuitBreaker {
  private failures = 0;
  private lastFailure = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  
  constructor(
    private maxFailures = 5,
    private resetTimeout = 60000 // 1 minute
  ) {}
  
  async execute<T>(operation: () => Promise<T>, operationName: string): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailure > this.resetTimeout) {
        this.state = 'half-open';
      } else {
        throw new Error(`Circuit breaker is OPEN for ${operationName}. Try again later.`);
      }
    }
    
    try {
      const result = await operation();
      this.reset();
      return result;
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }
  
  private recordFailure() {
    this.failures++;
    this.lastFailure = Date.now();
    
    if (this.failures >= this.maxFailures) {
      this.state = 'open';
    }
  }
  
  private reset() {
    this.failures = 0;
    this.state = 'closed';
  }
}

// Global circuit breakers for external services
export const circuitBreakers = {
  tavily: new CircuitBreaker(3, 30000),   // 3 failures, 30s reset
  claude: new CircuitBreaker(5, 60000),   // 5 failures, 1m reset  
  apify: new CircuitBreaker(3, 45000),    // 3 failures, 45s reset
};

/**
 * Performance monitoring utilities
 */
export class PerformanceMonitor {
  private static timers = new Map<string, number>();
  
  static start(operationName: string): void {
    this.timers.set(operationName, Date.now());
  }
  
  static end(operationName: string): number {
    const startTime = this.timers.get(operationName);
    if (!startTime) return 0;
    
    const duration = Date.now() - startTime;
    this.timers.delete(operationName);
    
    console.log(`[PERF] ${operationName}: ${duration}ms`);
    return duration;
  }
  
  static async measure<T>(operationName: string, operation: () => Promise<T>): Promise<T> {
    this.start(operationName);
    try {
      const result = await operation();
      this.end(operationName);
      return result;
    } catch (error) {
      this.end(operationName);
      throw error;
    }
  }
}

/**
 * Optimized external API call wrapper
 */
export async function callExternalAPI<T>(
  operation: () => Promise<T>,
  config: {
    name: string;
    timeout?: number;
    retries?: number;
    circuitBreaker?: CircuitBreaker;
  }
): Promise<T> {
  const {
    name,
    timeout = 10000,
    retries = 1,
    circuitBreaker
  } = config;
  
  const wrappedOperation = () => withTimeout(operation, { timeout, retries }, name);
  
  if (circuitBreaker) {
    return PerformanceMonitor.measure(
      name,
      () => circuitBreaker.execute(wrappedOperation, name)
    );
  }
  
  return PerformanceMonitor.measure(name, wrappedOperation);
}