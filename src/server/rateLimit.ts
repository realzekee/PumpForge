// Server-side sliding-window rate limiter
// Protects against API spam, automated bot abuse, and brute-force attempts.

interface RateLimitRecord {
  timestamps: number[];
}

export class RateLimiter {
  private records: Map<string, RateLimitRecord> = new Map();

  constructor(
    private readonly maxRequests: number,
    private readonly windowMs: number
  ) {}

  public isAllowed(key: string): { allowed: boolean; retryAfterMs: number } {
    const now = Date.now();
    let record = this.records.get(key);

    if (!record) {
      record = { timestamps: [] };
      this.records.set(key, record);
    }

    // Filter out timestamps outside window
    record.timestamps = record.timestamps.filter((ts) => now - ts < this.windowMs);

    if (record.timestamps.length >= this.maxRequests) {
      const oldest = record.timestamps[0];
      const retryAfterMs = Math.max(0, this.windowMs - (now - oldest));
      return { allowed: false, retryAfterMs };
    }

    record.timestamps.push(now);
    return { allowed: true, retryAfterMs: 0 };
  }

  public clean(): void {
    const now = Date.now();
    for (const [key, record] of this.records.entries()) {
      record.timestamps = record.timestamps.filter((ts) => now - ts < this.windowMs);
      if (record.timestamps.length === 0) {
        this.records.delete(key);
      }
    }
  }
}

// Instantiate rate limiters for different action profiles
export const tradeLimiter = new RateLimiter(25, 5000); // 25 trades per 5 seconds
export const arcadeLimiter = new RateLimiter(15, 5000); // 15 arcade rolls per 5 seconds
export const dailyRewardLimiter = new RateLimiter(1, 10000); // 1 claim attempt per 10 seconds
export const bugReportLimiter = new RateLimiter(2, 60000); // 2 bug reports per 60 seconds
export const adminLimiter = new RateLimiter(40, 10000); // 40 admin calls per 10 seconds

// Periodic cleanup every 5 minutes (unrefed so it does not block serverless execution)
const cleanupTimer = setInterval(() => {
  tradeLimiter.clean();
  arcadeLimiter.clean();
  dailyRewardLimiter.clean();
  bugReportLimiter.clean();
  adminLimiter.clean();
}, 300000);

if (cleanupTimer && typeof cleanupTimer.unref === "function") {
  cleanupTimer.unref();
}
