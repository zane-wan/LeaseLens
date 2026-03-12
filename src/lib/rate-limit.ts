type Bucket = {
  count: number
  resetAt: number
}

type LimitResult = {
  allowed: boolean
  remaining: number
  retryAfterSeconds: number
}

const globalRateStore = globalThis as unknown as {
  rateLimiterBuckets?: Map<string, Bucket>
}

const buckets = globalRateStore.rateLimiterBuckets ?? new Map<string, Bucket>()
if (!globalRateStore.rateLimiterBuckets) {
  globalRateStore.rateLimiterBuckets = buckets
}

export function consumeRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): LimitResult {
  const now = Date.now()
  const existing = buckets.get(key)

  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return {
      allowed: true,
      remaining: Math.max(0, maxRequests - 1),
      retryAfterSeconds: Math.ceil(windowMs / 1000),
    }
  }

  if (existing.count >= maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    }
  }

  existing.count += 1
  return {
    allowed: true,
    remaining: Math.max(0, maxRequests - existing.count),
    retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
  }
}

export function getClientIdentifier(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for")
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown"
  return headers.get("x-real-ip") || "unknown"
}
