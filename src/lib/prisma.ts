import { PrismaClient } from '@prisma/client'

const prismaClientSingleton = () => {
  // Limit connection pool to 2 per serverless instance to prevent
  // exhausting TiDB Cloud's connection limit across concurrent instances
  const url = new URL(process.env.DATABASE_URL || '')
  url.searchParams.set('connection_limit', '2')

  return new PrismaClient({
    datasourceUrl: url.toString(),
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
