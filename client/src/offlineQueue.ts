// Lightweight write queue: stores mutations in localStorage when offline,
// flushes them when connectivity returns. Last-write-wins on the server.

import { ApiError } from './api'

const QUEUE_KEY = 'auf-gehts:offlineQueue:v1'

export interface QueuedRequest {
  id: string
  url: string
  method: string
  body: unknown
  createdAt: string
  // Coalesce key: subsequent requests with the same key replace earlier ones
  // (e.g. flipping progress NotStarted → Active → Completed only sends the last).
  coalesceKey?: string
}

type Listener = (state: { online: boolean; queued: number }) => void
const listeners = new Set<Listener>()

function read(): QueuedRequest[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY)
    return raw ? JSON.parse(raw) as QueuedRequest[] : []
  } catch {
    return []
  }
}

function write(queue: QueuedRequest[]) {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue))
  } catch {
    // Quota exceeded — drop the oldest half rather than throw.
    try {
      localStorage.setItem(QUEUE_KEY, JSON.stringify(queue.slice(Math.floor(queue.length / 2))))
    } catch { /* give up */ }
  }
}

function notify() {
  const state = { online: navigator.onLine, queued: read().length }
  listeners.forEach(fn => { try { fn(state) } catch { /* swallow */ } })
}

export function subscribeOfflineState(fn: Listener): () => void {
  listeners.add(fn)
  fn({ online: navigator.onLine, queued: read().length })
  return () => { listeners.delete(fn) }
}

export function getQueuedCount() { return read().length }

export function enqueue(req: Omit<QueuedRequest, 'id' | 'createdAt'>) {
  const queue = read()
  // Coalesce: if a queued request has the same coalesceKey, replace it.
  const filtered = req.coalesceKey
    ? queue.filter(q => q.coalesceKey !== req.coalesceKey)
    : queue
  filtered.push({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
    ...req,
  })
  write(filtered)
  notify()
}

let flushing = false

type Fetcher = (url: RequestInfo | URL, init?: RequestInit) => Promise<Response>

async function send(req: QueuedRequest, fetcher: Fetcher): Promise<{ ok: boolean; drop: boolean }> {
  try {
    const res = await fetcher(req.url, {
      method: req.method,
      headers: { 'Content-Type': 'application/json' },
      body: req.body === undefined ? undefined : JSON.stringify(req.body),
    })
    if (res.ok || res.status === 204) return { ok: true, drop: true }
    // Permanent failures: 4xx (except 408/429) → drop silently to avoid loops.
    if (res.status >= 400 && res.status < 500 && res.status !== 408 && res.status !== 429) {
      console.warn('[offlineQueue] dropping', req.method, req.url, res.status)
      return { ok: false, drop: true }
    }
    return { ok: false, drop: false }
  } catch {
    return { ok: false, drop: false }
  }
}

export async function flushQueue(authedFetch: Fetcher) {
  if (flushing) return
  flushing = true
  try {
    while (navigator.onLine) {
      const queue = read()
      if (queue.length === 0) break
      const next = queue[0]
      const { drop } = await send(next, authedFetch)
      if (!drop) break // still failing; stop and retry later
      // Remove the head (re-read in case of concurrent enqueue)
      const after = read()
      const idx = after.findIndex(q => q.id === next.id)
      if (idx >= 0) {
        after.splice(idx, 1)
        write(after)
        notify()
      }
    }
  } finally {
    flushing = false
  }
}

// Decide whether an error from request() means we should queue (we're offline-ish).
export function isOfflineError(err: unknown): boolean {
  if (!navigator.onLine) return true
  return err instanceof ApiError && err.status === 0
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => { notify() })
  window.addEventListener('offline', () => { notify() })
}
