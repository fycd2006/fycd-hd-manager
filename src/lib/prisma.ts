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
export default prisma;
