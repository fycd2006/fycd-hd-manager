import Redis from 'ioredis'

const redisUrl = process.env.REDIS_URL

let redisClient: Redis | null = null

if (redisUrl) {
  try {
    redisClient = new Redis(redisUrl, {
      maxRetriesPerRequest: 1,
      lazyConnect: true,
      enableOfflineQueue: false
    })

    redisClient.on('error', (err) => {
      console.warn('[Redis Warning] Connection error:', err.message)
    })
  } catch (err: any) {
    console.warn('[Redis Warning] Failed to initialize Redis client:', err?.message)
    redisClient = null
  }
}

export async function getCache<T>(key: string): Promise<T | null> {
  if (!redisClient) return null
  try {
    const data = await redisClient.get(key)
    if (!data) return null
    return JSON.parse(data) as T
  } catch (error) {
    console.warn(`[Redis Cache Miss/Error] Key: ${key}`, error)
    return null
  }
}

export async function setCache(key: string, data: any, ttlSeconds = 300): Promise<void> {
  if (!redisClient) return
  try {
    const payload = JSON.stringify(data)
    await redisClient.set(key, payload, 'EX', ttlSeconds)
  } catch (error) {
    console.warn(`[Redis Cache Set Error] Key: ${key}`, error)
  }
}

export async function delCache(keys: string | string[]): Promise<void> {
  if (!redisClient) return
  try {
    const keyList = Array.isArray(keys) ? keys : [keys]
    if (keyList.length > 0) {
      await redisClient.del(...keyList)
    }
  } catch (error) {
    console.warn(`[Redis Cache Del Error] Keys: ${keys}`, error)
  }
}

export default redisClient
