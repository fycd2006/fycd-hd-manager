import { PrismaClient } from '@prisma/client'

const prismaClientSingleton = () => {
  // Limit connection pool to 5 per serverless instance to balance
  // query throughput and TiDB Cloud's max connection limit
  const rawUrl = process.env.DATABASE_URL
  let datasourceUrl: string | undefined = undefined

  if (rawUrl) {
    try {
      const url = new URL(rawUrl)
      url.searchParams.set('connection_limit', '5')
      url.searchParams.set('pool_timeout', '20')
      url.searchParams.set('connect_timeout', '15')
      datasourceUrl = url.toString()
    } catch {
      datasourceUrl = rawUrl
    }
  }

  return new PrismaClient({
    ...(datasourceUrl ? { datasourceUrl } : {}),
    log: process.env.NODE_ENV === 'development'
      ? ['query', 'error', 'warn']
      : ['error'],
  })
}

declare global {
  var prismaGlobal: undefined | ReturnType<typeof prismaClientSingleton>
}

export const prisma = globalThis.prismaGlobal ?? prismaClientSingleton()

globalThis.prismaGlobal = prisma

/**
 * Executes a database callback with automatic reconnect retry on transient TiDB dropped connections (P1001/ECONNRESET).
 */
export async function withDbRetry<T>(fn: () => Promise<T>, maxRetries = 2): Promise<T> {
  let attempt = 0
  while (true) {
    try {
      return await fn()
    } catch (err: any) {
      attempt++
      const msg = String(err?.message || '')
      const isConnectionError =
        msg.includes("Can't reach database server") ||
        msg.includes('P1001') ||
        msg.includes('ETIMEDOUT') ||
        msg.includes('ECONNRESET') ||
        msg.includes('Connection closed') ||
        msg.includes('Server has gone away')

      if (attempt <= maxRetries && isConnectionError) {
        console.warn(`[DB Retry] Transient connection drop on attempt ${attempt}, reconnecting...`)
        try {
          await prisma.$disconnect()
        } catch {}
        await new Promise(resolve => setTimeout(resolve, 250 * attempt))
        continue
      }
      throw err
    }
  }
}

export default prisma;

