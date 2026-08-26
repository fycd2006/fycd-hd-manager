import { NextResponse } from 'next/server'
import { applyRateLimit } from './rate-limiter'
import { authorizeAction, AuthorizationResult } from './authorize'
import { handleApiError } from './error-handler'
import type { RolePermissions } from './permissions'
import { ZodSchema } from 'zod'

export interface ApiHandlerContext<TParams = any, TBody = any> {
  request: Request
  params: TParams
  body?: TBody
  auth?: AuthorizationResult
}

export interface ApiHandlerOptions<TParams = any, TBody = any> {
  // Rate limiting options
  rateLimit?: {
    limit?: number
    windowSeconds?: number
    keyGenerator?: (request: Request, params: TParams) => string
  }
  // Authorization options
  auth?: {
    action: keyof RolePermissions
    resolveTableId?: (params: TParams, body?: TBody) => number | undefined
    resolveWorkspaceId?: (params: TParams, body?: TBody) => number | undefined
    resolveDatabaseId?: (params: TParams, body?: TBody) => number | undefined
  }
  // Body schema validation
  bodySchema?: ZodSchema<TBody>
  // Params schema validation
  paramsSchema?: ZodSchema<TParams>
}

/**
 * Higher-order function wrapping Next.js route handlers with:
 * 1. Async params resolution & validation
 * 2. Sliding window rate limiting
 * 3. Body JSON parsing & Zod schema validation
 * 4. Workspace/Table RBAC authorization
 * 5. Unified try/catch error handling and logging
 */
export function withApiHandler<TParams = any, TBody = any>(
  handler: (ctx: ApiHandlerContext<TParams, TBody>) => Promise<NextResponse | Response | any>,
  options?: ApiHandlerOptions<TParams, TBody>
) {
  return async (request: Request, segmentData: { params: Promise<TParams> }): Promise<NextResponse> => {
    try {
      // 1. Resolve params
      let params = {} as TParams
      if (segmentData && segmentData.params) {
        params = await segmentData.params
      }

      // 2. Validate params if schema provided
      if (options?.paramsSchema) {
        const paramResult = options.paramsSchema.safeParse(params)
        if (!paramResult.success) {
          return NextResponse.json(
            { error: '無效的請求參數', details: paramResult.error.format() },
            { status: 400 }
          )
        }
        params = paramResult.data
      }

      // 3. Rate limiting
      if (options?.rateLimit) {
        const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'anonymous'
        const key = options.rateLimit.keyGenerator
          ? options.rateLimit.keyGenerator(request, params)
          : `${request.method}:${new URL(request.url).pathname}:${ip}`

        const rateLimitResponse = await applyRateLimit(
          key,
          options.rateLimit.limit ?? 60,
          options.rateLimit.windowSeconds ?? 60
        )
        if (rateLimitResponse) return rateLimitResponse
      }

      // 4. Parse & Validate body for mutations
      let body: TBody | undefined = undefined
      if (['POST', 'PUT', 'PATCH'].includes(request.method)) {
        try {
          const rawBody = await request.json()
          if (options?.bodySchema) {
            const bodyResult = options.bodySchema.safeParse(rawBody)
            if (!bodyResult.success) {
              return NextResponse.json(
                { error: '請求資料格式不正確', details: bodyResult.error.format() },
                { status: 400 }
              )
            }
            body = bodyResult.data
          } else {
            body = rawBody
          }
        } catch {
          if (options?.bodySchema) {
            return NextResponse.json({ error: '請提供有效的 JSON 請求內容' }, { status: 400 })
          }
        }
      }

      // 5. Authorization
      let authResult: AuthorizationResult | undefined = undefined
      if (options?.auth) {
        const tableId = options.auth.resolveTableId
          ? options.auth.resolveTableId(params, body)
          : ((params as any)?.tableId ? parseInt((params as any).tableId) : undefined)

        const workspaceId = options.auth.resolveWorkspaceId
          ? options.auth.resolveWorkspaceId(params, body)
          : ((params as any)?.id || (params as any)?.workspaceId ? parseInt((params as any).id || (params as any).workspaceId) : undefined)

        const databaseId = options.auth.resolveDatabaseId
          ? options.auth.resolveDatabaseId(params, body)
          : ((params as any)?.databaseId ? parseInt((params as any).databaseId) : undefined)

        const { errorResponse, auth } = await authorizeAction({
          workspaceId,
          tableId,
          databaseId,
          action: options.auth.action,
        })

        if (errorResponse) return errorResponse
        authResult = auth
      }

      // 6. Execute Handler
      const result = await handler({
        request,
        params,
        body,
        auth: authResult,
      })

      // 7. Format response
      if (result instanceof NextResponse || result instanceof Response) {
        return result as NextResponse
      }

      return NextResponse.json(result)
    } catch (error) {
      return handleApiError(error)
    }
  }
}
