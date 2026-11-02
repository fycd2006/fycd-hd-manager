import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { APP_CURRENT_VERSION, CHANGELOG_RELEASES } from '@/config/changelog'

export const GET = withApiHandler(async () => {
  const latestRelease = CHANGELOG_RELEASES[0] ?? {
    version: APP_CURRENT_VERSION,
    releaseDate: new Date().toISOString().split('T')[0],
    items: [],
  }

  return NextResponse.json(
    {
      version: APP_CURRENT_VERSION,
      latestRelease,
      history: CHANGELOG_RELEASES,
    },
    {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
      },
    }
  )
})
