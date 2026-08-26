import redisClient from '@/lib/redis'
import { NextResponse } from 'next/server'

// Atomic increment-and-expire Lua script.
// Returns the current count after incrementing.
// Sets TTL only on the first increment (when key is new).
const RATE_LIMIT_LUA = `
local current = redis.call('INCR', KEYS[1])
if current == 1 then
  redis.call('EXPIRE', KEYS[1], ARGV[1])
end
return current
`

/**
 * Sliding window IP / identifier rate limiter using Redis.
 * If Redis is offline or unavailable, fails open (returns null).
 */
export async function applyRateLimit(
  identifier: string,
  limit = 60,
  windowSeconds = 60
): Promise<NextResponse | null> {
  if (!redisClient) return null

  try {
    const key = `ratelimit:${identifier}`
    const current = await redisClient.eval(
      RATE_LIMIT_LUA,
      1,
      key,
      String(windowSeconds)
    ) as number

    if (current > limit) {
      return NextResponse.json(
        { error: '請求過於頻繁，請稍後再試' },
        {
          status: 429,
          headers: {
            'Retry-After': String(windowSeconds),
            'X-RateLimit-Limit': String(limit),
            'X-RateLimit-Remaining': '0'
          }
        }
      )
    }
  } catch (error) {
    console.warn('[Rate Limit Warning]: Redis rate limit check failed', error)
  }

  return null
}

