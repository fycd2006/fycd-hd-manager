import { withApiHandler } from '../api-handler'
import { NextResponse } from 'next/server'
import { z } from 'zod'

jest.mock('@/lib/prisma', () => ({
  user: { findFirst: jest.fn() },
  databaseTable: { findFirst: jest.fn() },
  workspaceUser: { findUnique: jest.fn() },
}))

jest.mock('@/lib/auth', () => ({
  getSessionUser: jest.fn().mockResolvedValue({ id: 1, username: 'testuser', email: 'test@example.com', role: 'admin' }),
}))

jest.mock('@/lib/rate-limiter', () => ({
  applyRateLimit: jest.fn().mockResolvedValue(null),
}))

jest.mock('@/lib/redis', () => ({
  getCache: jest.fn().mockResolvedValue(null),
  setCache: jest.fn().mockResolvedValue(true),
  delCache: jest.fn().mockResolvedValue(true),
}))

describe('withApiHandler', () => {
  it('should successfully handle a basic GET request and return JSON', async () => {
    const handler = withApiHandler(async () => {
      return { success: true, data: [1, 2, 3] }
    })

    const request = new Request('http://localhost:3000/api/test')
    const response = await handler(request, { params: Promise.resolve({}) })

    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json).toEqual({ success: true, data: [1, 2, 3] })
  })

  it('should validate request body with Zod schema and reject invalid payloads', async () => {
    const schema = z.object({
      name: z.string().min(3),
      age: z.number(),
    })

    const handler = withApiHandler(
      async ({ body }) => {
        return { created: true, body }
      },
      { bodySchema: schema }
    )

    const invalidRequest = new Request('http://localhost:3000/api/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'ab', age: 'invalid' }),
    })

    const response = await handler(invalidRequest, { params: Promise.resolve({}) })
    expect(response.status).toBe(400)
    const json = await response.json()
    expect(json.error).toBe('請求資料格式不正確')
  })

  it('should pass validated body to the handler for valid requests', async () => {
    const schema = z.object({
      name: z.string().min(3),
      age: z.number(),
    })

    const handler = withApiHandler(
      async ({ body }) => {
        return { created: true, user: body }
      },
      { bodySchema: schema }
    )

    const validRequest = new Request('http://localhost:3000/api/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Alice', age: 25 }),
    })

    const response = await handler(validRequest, { params: Promise.resolve({}) })
    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json).toEqual({ created: true, user: { name: 'Alice', age: 25 } })
  })

  it('should catch unhandled errors and return 500 error response', async () => {
    const handler = withApiHandler(async () => {
      throw new Error('Database disconnected')
    })

    const request = new Request('http://localhost:3000/api/test')
    const response = await handler(request, { params: Promise.resolve({}) })

    expect(response.status).toBe(500)
    const json = await response.json()
    expect(json.error).toBeDefined()
  })

  it('should support returning custom NextResponse objects directly', async () => {
    const handler = withApiHandler(async () => {
      return NextResponse.json({ custom: true }, { status: 201 })
    })

    const request = new Request('http://localhost:3000/api/test')
    const response = await handler(request, { params: Promise.resolve({}) })

    expect(response.status).toBe(201)
    const json = await response.json()
    expect(json).toEqual({ custom: true })
  })
})
