import Pusher from 'pusher'

const appId = process.env.PUSHER_APP_ID
const key = process.env.NEXT_PUBLIC_PUSHER_KEY
const secret = process.env.PUSHER_SECRET
const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER || 'ap1'

let pusherServerInstance: Pusher | null = null

if (appId && key && secret) {
  pusherServerInstance = new Pusher({
    appId,
    key,
    secret,
    cluster,
    useTLS: true,
  })
}

export const pusherServer = pusherServerInstance

/**
 * Triggers a real-time event on a specific table channel
 */
export async function triggerTableEvent(tableId: number, event: string, data: any) {
  if (!pusherServer) return
  try {
    await pusherServer.trigger(`table-${tableId}`, event, data)
  } catch (err: any) {
    console.warn('[Pusher Server Warning] Failed to trigger event:', err?.message || err)
  }
}
