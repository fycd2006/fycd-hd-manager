import PusherClient from 'pusher-js'

const key = process.env.NEXT_PUBLIC_PUSHER_KEY
const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER || 'ap1'

let pusherClientInstance: PusherClient | null = null

export function getPusherClient(): PusherClient | null {
  if (typeof window === 'undefined') return null
  if (!key) return null

  if (!pusherClientInstance) {
    pusherClientInstance = new PusherClient(key, {
      cluster,
    })
  }

  return pusherClientInstance
}
