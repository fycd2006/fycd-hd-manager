import { NextResponse } from 'next/server'

export function handleApiError(error: unknown, defaultMessage = '操作失敗，請稍後再試'): NextResponse {
  console.error('[API Error]', error)
  const isDev = process.env.NODE_ENV === 'development'
  const errorMessage = isDev
    ? (error as Error)?.message || defaultMessage
    : defaultMessage
  return NextResponse.json({ error: errorMessage }, { status: 500 })
}
