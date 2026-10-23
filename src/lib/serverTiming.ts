export interface ServerTiming {
  time<T>(name: string, fn: () => Promise<T>): Promise<T>
  add(name: string, ms: number): void
  get(name: string): number
  header(): string
}

export function createServerTiming(): ServerTiming {
  const entries = new Map<string, number>()

  const add = (name: string, ms: number) => {
    entries.set(name, (entries.get(name) ?? 0) + ms)
  }

  return {
    async time<T>(name: string, fn: () => Promise<T>): Promise<T> {
      const start = performance.now()
      try {
        return await fn()
      } finally {
        add(name, performance.now() - start)
      }
    },
    add,
    get: (name) => entries.get(name) ?? 0,
    header: () =>
      Array.from(entries, ([name, ms]) => `${name};dur=${ms.toFixed(1)}`).join(', '),
  }
}
