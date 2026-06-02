import { supabase } from './supabase'
import { enqueue, flushQueue, isOfflineError } from './offlineQueue'

const API_BASE = `${(import.meta.env.VITE_API_URL as string) ?? ''}/api`

export interface Week {
  id: string
  number: number
  title: string
  description: string | null
  setCount: number
  completedCount: number
  tagCount: number
  completedTagCount: number
  isLocked: boolean
}

export interface WeekDetail {
  id: string
  number: number
  title: string
  description: string | null
  sets: WordSet[]
  readingTexts: ReadingTextSummary[]
  tags: Tag[]
  isLocked: boolean
}

export interface Tag {
  id: string
  weekId: string
  tagNumber: number
  name: string
  wordSetId: string | null
  wordSetName: string | null
  wordCount: number | null
  readingTextId: string | null
  readingTextTitle: string | null
  questionCount: number
  hasAudio: boolean
  completedStepsMask: number
  lastStep: number
  isCompleted: boolean
}

export interface TagDetail {
  id: string
  weekId: string
  weekNumber: number
  weekTitle: string
  tagNumber: number
  name: string
  wordSet: WordSet | null
  words: Word[]
  readingText: ReadingText | null
  completedStepsMask: number
  lastStep: number
  isCompleted: boolean
  isLocked: boolean
}

export interface GeneratedTagPassage {
  title: string
  content: string
  level: string
  questions: ReadingTextQuestion[]
}

export interface ReadingTextSummary {
  id: string
  title: string
  level: string | null
  questionCount: number
  charCount: number
}

export interface WordSet {
  id: string
  slug: string
  weekId: string | null
  weekNumber: number | null
  name: string
  description: string | null
  level: string | null
  isPublic: boolean
  isOfficial: boolean
  isOwner: boolean
  isFavorite: boolean
  wordCount: number
  progressStatus: 'NotStarted' | 'Active' | 'Completed'
  createdByUserId: string | null
  createdByName: string | null
  createdAt: string
}

export interface Word {
  id: string
  wordSetId: string
  front: string
  back: string
  context: string | null
  displayOrder: number
  createdAt: string
}

export interface Library {
  favorites: WordSet[]
  mine: WordSet[]
  completed: WordSet[]
  browse: WordSet[]
}

export interface Stats {
  vocabCount: number
  activeSetCount: number
  completedSetCount: number
  wordsAddedThisWeek: number
}

export interface WordDefinition {
  partOfSpeech: string
  definition: string
  examples: string[]
}

export interface WordLookup {
  word: string
  translation: string | null
  gender: string | null
  plural: string | null
  definitions: WordDefinition[]
  alternatives: string[]
}

export interface GeneratedText {
  text: string
  remainingToday: number
}

export type UserRole = 'Admin' | 'Default' | 'ViewOnly'

export type ReadingQuestionType = 'MultipleChoice' | 'TrueFalse' | 'ShortAnswer' | 'FreeText'

export interface ReadingTextQuestion {
  id: string
  displayOrder: number
  type: ReadingQuestionType
  prompt: string
  options: string[] | null
  correctAnswer: string | null
}

export interface ReadingText {
  id: string
  title: string
  content: string
  level: string | null
  weekId: string | null
  weekNumber: number | null
  tagId: string | null
  isUnlocked: boolean
  createdByUserId: string | null
  createdByName: string | null
  isOwner: boolean
  createdAt: string
  audioUrl: string | null
  audioDurationSec: number | null
  audioVoice: string | null
  questions: ReadingTextQuestion[]
}

export interface UserProfile {
  id: string
  email: string
  displayName: string | null
  role: UserRole
  currentStreak: number
  longestStreak: number
  lastActivityDate: string | null
  hasAnthropicKey: boolean
  createdAt: string
  lastSeenAt: string
}

export interface FriendProgress {
  userId: string
  displayName: string
  currentStreak: number
  currentWeekNumber: number | null
  currentWeekTitle: string | null
  currentWeekCompleted: number
  currentWeekTotal: number
}

export interface Dashboard {
  friends: FriendProgress[]
}

export type FriendshipState =
  | 'Self'
  | 'None'
  | 'PendingOutgoing'
  | 'PendingIncoming'
  | 'Friends'
  | 'Declined'

export interface PublicUserProfile {
  id: string
  displayName: string
  currentStreak: number
  longestStreak: number
  friendshipState: FriendshipState
}

export interface UserDirectoryEntry {
  id: string
  displayName: string
  friendshipState: FriendshipState
}

export interface UserDirectoryPage {
  items: UserDirectoryEntry[]
  page: number
  pageSize: number
  total: number
}

export interface FriendSummary {
  id: string
  displayName: string
  currentStreak: number
}

export interface FriendRequest {
  id: string
  otherUserId: string
  otherUserDisplayName: string
  createdAt: string
}

export interface PendingRequests {
  incoming: FriendRequest[]
  outgoing: FriendRequest[]
}

export type LogLevel = 'Info' | 'Warning' | 'Error' | 'Critical'

export interface LogEntry {
  id: number
  timestamp: string
  level: LogLevel
  eventType: string
  message: string | null
  traceId: string | null
  userId: string | null
  endpoint: string | null
  httpMethod: string | null
  statusCode: number | null
  durationMs: number | null
  concurrency: number | null
  source: string | null
  metadataJson: string | null
}

export interface LogsPage {
  total: number
  page: number
  pageSize: number
  items: LogEntry[]
}

export interface LogQueryParams {
  level?: LogLevel
  eventType?: string
  endpoint?: string
  traceId?: string
  userId?: string
  minDurationMs?: number
  since?: string
  page?: number
  pageSize?: number
}

export interface SlowEndpoint {
  endpoint: string | null
  count: number
  avgMs: number
  p95Ms: number
  maxMs: number
}

export type FindingSeverity = 'high' | 'medium' | 'low' | 'info'

export interface DiagnosticFinding {
  severity: FindingSeverity
  category: string
  title: string
  summary: string
  evidence: Record<string, unknown>
}

export interface DiagnosticTotals {
  requests: number
  slowRequests: number
  errors: number
  p50Ms: number
  p95Ms: number
  p99Ms: number
  concurrencyPeak: number
}

export interface DiagnosticReport {
  windowHours: number
  sinceUtc: string
  totals: DiagnosticTotals
  findings: DiagnosticFinding[]
}

export interface LogsStats {
  sinceUtc: string
  concurrencyCurrent: number
  concurrencyPeak: number
  byTypeAndLevel: { level: LogLevel; eventType: string; count: number }[]
  slowEndpoints: SlowEndpoint[]
  slowQueryCount: number
}

export interface ActivityLogEntry {
  id: number
  timestamp: string
  eventType: string
  userId: string | null
  userName: string | null
  userEmail: string | null
  message: string | null
  metadataJson: string | null
  link?: string | null
  targetLabel?: string | null
}

export interface ActivityLogsPage {
  total: number
  page: number
  pageSize: number
  items: ActivityLogEntry[]
}

export interface ActivityLogParams {
  eventType?: string
  userId?: string
  search?: string
  since?: string
  until?: string
  page?: number
  pageSize?: number
}

export interface ActivityTypeCount {
  eventType: string
  count: number
}

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

// Loading progress: tracks inflight request count, notifies subscribers.
let inflight = 0
const loadingListeners = new Set<(count: number) => void>()
export function onLoadingChange(fn: (count: number) => void) {
  loadingListeners.add(fn)
  return () => { loadingListeners.delete(fn) }
}
function notifyLoading() {
  loadingListeners.forEach(fn => fn(inflight))
}

// Client-side perf telemetry: buffer recent timings, flush periodically.
interface ClientSample {
  traceId?: string
  url: string
  method: string
  status?: number
  durationMs: number
  started: string
  network?: string
}
const sampleBuffer: ClientSample[] = []
let lastTraceId: string | null = null
const dashboardInflight = new Map<string, Promise<Dashboard>>()
export function getLastTraceId() { return lastTraceId }
;(globalThis as any).__appTraces = sampleBuffer

const FLUSH_INTERVAL_MS = 15_000
const FLUSH_MAX = 50
async function flushSamples() {
  if (sampleBuffer.length === 0) return
  const batch = sampleBuffer.splice(0, sampleBuffer.length)
  try {
    await fetch(`${API_BASE}/client-metrics`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bundleVersion: (import.meta.env.VITE_BUNDLE_VERSION as string) ?? 'dev',
        samples: batch.slice(0, 100),
      }),
      keepalive: true,
    })
  } catch {
    // Drop on failure; don't requeue to avoid loops.
  }
}
if (typeof window !== 'undefined') {
  setInterval(flushSamples, FLUSH_INTERVAL_MS)
  window.addEventListener('beforeunload', flushSamples)
}

// Generic authed fetch used by both `request` and the offline-queue flusher.
// Returns the raw Response so the queue can inspect statuses without parsing JSON.
async function authedFetch(url: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData.session?.access_token
  return fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  })
}

// Wraps a mutation: if offline (or network error), queue it and resolve optimistically.
// On reconnect, the queue flushes in FIFO order with last-write-wins per coalesceKey.
async function queueOnOffline<T>(url: string, method: string, body: unknown, coalesceKey?: string): Promise<T> {
  if (!navigator.onLine) {
    enqueue({ url, method, body, coalesceKey })
    return undefined as T
  }
  try {
    return await request<T>(url, { method, body: JSON.stringify(body) })
  } catch (e) {
    if (isOfflineError(e)) {
      enqueue({ url, method, body, coalesceKey })
      // Best-effort attempt to flush in case we just came back online.
      void flushQueue(authedFetch)
      return undefined as T
    }
    throw e
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => { flushQueue(authedFetch) })
  // Also try once on load (covers tab-open-with-pending-queue).
  setTimeout(() => { if (navigator.onLine) flushQueue(authedFetch) }, 1500)
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  inflight++
  notifyLoading()
  const started = performance.now()
  const startedIso = new Date().toISOString()
  const method = (options?.method ?? 'GET').toUpperCase()
  const network = (navigator as any).connection?.effectiveType
  let res: Response | null = null
  try {
  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData.session?.access_token
  try {
    res = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(lastTraceId ? { 'X-Client-Trace-Id': lastTraceId } : {}),
        ...options?.headers,
      },
    })
    const tid = res.headers.get('x-trace-id')
    if (tid) lastTraceId = tid
  } catch {
    throw new ApiError('Network error', 0)
  }
  if (!res.ok) {
    let msg = res.statusText || `HTTP ${res.status}`
    try {
      const body = await res.text()
      if (body) {
        try {
          const json = JSON.parse(body)
          msg = json.error ?? json.title ?? json.message ?? body
        } catch {
          msg = body
        }
      }
    } catch {}
    throw new ApiError(msg, res.status)
  }
  if (res.status === 204) return undefined as T
  return res.json()
  } finally {
    inflight = Math.max(0, inflight - 1)
    notifyLoading()
    const duration = Math.round(performance.now() - started)
    sampleBuffer.push({
      traceId: res?.headers.get('x-trace-id') ?? undefined,
      url: url.replace(API_BASE, '/api'),
      method,
      status: res?.status,
      durationMs: duration,
      started: startedIso,
      network,
    })
    if (sampleBuffer.length >= FLUSH_MAX) flushSamples()
  }
}

export const api = {
  getStats: () => request<Stats>(`${API_BASE}/stats`),
  // Dedupe in-flight dashboard fetches keyed by weekId. React StrictMode double-mounts
  // in dev fire the effect twice; coalescing also helps if two components request the
  // dashboard simultaneously.
  getDashboard: (weekId: string) => {
    const existing = dashboardInflight.get(weekId)
    if (existing) return existing
    const promise = request<Dashboard>(`${API_BASE}/dashboard?weekId=${encodeURIComponent(weekId)}`)
      .finally(() => { dashboardInflight.delete(weekId) })
    dashboardInflight.set(weekId, promise)
    return promise
  },

  getUserProfile: (userId: string) =>
    request<PublicUserProfile>(`${API_BASE}/users/${userId}/profile`),
  browseUsers: (q?: string, page: number = 1, pageSize: number = 25) => {
    const params = new URLSearchParams()
    if (q && q.trim()) params.set('q', q.trim())
    params.set('page', String(page))
    params.set('pageSize', String(pageSize))
    return request<UserDirectoryPage>(`${API_BASE}/users/directory?${params.toString()}`)
  },

  listFriends: () => request<FriendSummary[]>(`${API_BASE}/friends`),
  listFriendRequests: () => request<PendingRequests>(`${API_BASE}/friends/requests`),
  getFriendRequestCount: () =>
    request<{ incoming: number }>(`${API_BASE}/friends/requests/count`),
  sendFriendRequest: (addresseeId: string) =>
    request<{ id: string; status: string }>(`${API_BASE}/friends/requests`, {
      method: 'POST',
      body: JSON.stringify({ addresseeId }),
    }),
  acceptFriendRequest: (id: string) =>
    request<void>(`${API_BASE}/friends/requests/${id}/accept`, { method: 'POST' }),
  declineFriendRequest: (id: string) =>
    request<void>(`${API_BASE}/friends/requests/${id}/decline`, { method: 'POST' }),
  cancelFriendRequest: (id: string) =>
    request<void>(`${API_BASE}/friends/requests/${id}`, { method: 'DELETE' }),
  unfriend: (userId: string) =>
    request<void>(`${API_BASE}/friends/${userId}`, { method: 'DELETE' }),

  listWeeks: () => request<Week[]>(`${API_BASE}/weeks`),
  getWeek: (idOrNumber: string | number) => request<WeekDetail>(`${API_BASE}/weeks/${idOrNumber}`),
  createWeek: (number: number, title: string, description?: string) =>
    request<{ id: string; number: number; title: string; description: string | null }>(`${API_BASE}/weeks`, {
      method: 'POST',
      body: JSON.stringify({ number, title, description: description ?? null }),
    }),
  updateWeek: (id: string, data: { number?: number; title?: string; description?: string }) =>
    request<{ id: string; number: number; title: string; description: string | null }>(`${API_BASE}/weeks/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ number: data.number ?? null, title: data.title ?? null, description: data.description ?? null }),
    }),
  deleteWeek: (id: string) => request<void>(`${API_BASE}/weeks/${id}`, { method: 'DELETE' }),

  listTags: (weekId: string) => request<Tag[]>(`${API_BASE}/weeks/${weekId}/tags`),
  getTag: (id: string) => request<TagDetail>(`${API_BASE}/tags/${id}`),
  createTag: (weekId: string, data: { tagNumber: number; name: string; wordSetId?: string | null; readingTextId?: string | null }) =>
    request<{ id: string; weekId: string; tagNumber: number; name: string; wordSetId: string | null; readingTextId: string | null }>(
      `${API_BASE}/weeks/${weekId}/tags`,
      {
        method: 'POST',
        body: JSON.stringify({
          tagNumber: data.tagNumber,
          name: data.name,
          wordSetId: data.wordSetId ?? null,
          readingTextId: data.readingTextId ?? null,
        }),
      }
    ),
  updateTag: (id: string, data: { tagNumber?: number; name?: string; wordSetId?: string | null; readingTextId?: string | null; clearWordSet?: boolean; clearReadingText?: boolean }) =>
    request<{ id: string; tagNumber: number; name: string; wordSetId: string | null; readingTextId: string | null }>(
      `${API_BASE}/tags/${id}`,
      {
        method: 'PUT',
        body: JSON.stringify({
          tagNumber: data.tagNumber ?? null,
          name: data.name ?? null,
          wordSetId: data.wordSetId ?? null,
          readingTextId: data.readingTextId ?? null,
          clearWordSet: data.clearWordSet ?? false,
          clearReadingText: data.clearReadingText ?? false,
        }),
      }
    ),
  deleteTag: (id: string) => request<void>(`${API_BASE}/tags/${id}`, { method: 'DELETE' }),
  completeTagStep: (id: string, stepIndex: number) =>
    request<{ completedStepsMask: number; lastStep: number; isCompleted: boolean }>(`${API_BASE}/tags/${id}/progress`, {
      method: 'POST',
      body: JSON.stringify({ stepIndex }),
    }),
  generateTagPassage: (id: string, wordSetId: string, level?: string, questionCount?: number) =>
    request<GeneratedTagPassage>(`${API_BASE}/tags/${id}/generate-passage`, {
      method: 'POST',
      body: JSON.stringify({ wordSetId, level: level ?? null, questionCount: questionCount ?? null }),
    }),

  getLibrary: () => request<Library>(`${API_BASE}/sets/library`),
  getSet: (idOrSlug: string) => request<WordSet>(`${API_BASE}/sets/${idOrSlug}`),
  createSet: (data: { weekId?: string; name: string; description?: string; level?: string; isPublic: boolean; isOfficial?: boolean }) =>
    request<WordSet>(`${API_BASE}/sets`, {
      method: 'POST',
      body: JSON.stringify({
        weekId: data.weekId ?? null,
        name: data.name,
        description: data.description ?? null,
        level: data.level ?? null,
        isPublic: data.isPublic,
        isOfficial: data.isOfficial ?? false,
      }),
    }),
  deleteSet: (id: string) => request<void>(`${API_BASE}/sets/${id}`, { method: 'DELETE' }),
  updateSet: (id: string, data: { name?: string; description?: string; level?: string; isPublic?: boolean; weekId?: string | null; isOfficial?: boolean; clearWeek?: boolean }) =>
    request<WordSet>(`${API_BASE}/sets/${id}`, {
      method: 'PUT',
      body: JSON.stringify({
        name: data.name ?? null,
        description: data.description ?? null,
        level: data.level ?? null,
        isPublic: data.isPublic ?? null,
        weekId: data.weekId ?? null,
        isOfficial: data.isOfficial ?? null,
        clearWeek: data.clearWeek ?? false,
      }),
    }),

  setProgress: (idOrSlug: string, status: 'NotStarted' | 'Active' | 'Completed') =>
    queueOnOffline<void>(
      `${API_BASE}/sets/${idOrSlug}/progress`,
      'PUT',
      { status },
      `progress:${idOrSlug}`,
    ),
  setFavorite: (idOrSlug: string, isFavorite: boolean) =>
    queueOnOffline<void>(
      `${API_BASE}/sets/${idOrSlug}/favorite`,
      'PUT',
      { isFavorite },
      `favorite:${idOrSlug}`,
    ),
  searchSets: (q?: string) =>
    request<WordSet[]>(`${API_BASE}/sets/search${q ? `?q=${encodeURIComponent(q)}` : ''}`),

  listWords: (idOrSlug: string) => request<Word[]>(`${API_BASE}/sets/${idOrSlug}/words`),

  getCombinedWeekSet: (idOrNumber: string | number) =>
    request<WordSet>(`${API_BASE}/weeks/${idOrNumber}/combined-set`),
  listCombinedWeekWords: (idOrNumber: string | number) =>
    request<Word[]>(`${API_BASE}/weeks/${idOrNumber}/combined-set/words`),
  setCombinedWeekProgress: (idOrNumber: string | number, status: 'NotStarted' | 'Active' | 'Completed') =>
    queueOnOffline<void>(
      `${API_BASE}/weeks/${idOrNumber}/combined-set/progress`,
      'PUT',
      { status },
      `combined-progress:${idOrNumber}`,
    ),
  addWord: (idOrSlug: string, front: string, back: string, context?: string) =>
    request<Word>(`${API_BASE}/sets/${idOrSlug}/words`, {
      method: 'POST',
      body: JSON.stringify({ front, back, context: context ?? null }),
    }),
  bulkAddWords: (idOrSlug: string, items: { front: string; back: string }[]) =>
    request<{ count: number }>(`${API_BASE}/sets/${idOrSlug}/words/bulk`, {
      method: 'POST',
      body: JSON.stringify(items),
    }),
  deleteWord: (id: string) => request<void>(`${API_BASE}/words/${id}`, { method: 'DELETE' }),
  updateWord: (id: string, front: string, back: string, context?: string) =>
    request<Word>(`${API_BASE}/words/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ front, back, context: context ?? null }),
    }),

  saveToVocab: (front: string, back: string, context?: string) =>
    request<Word>(`${API_BASE}/vocab/save`, {
      method: 'POST',
      body: JSON.stringify({ front, back, context: context ?? null }),
    }),

  lookupWord: (word: string) => request<WordLookup>(`${API_BASE}/dictionary/${encodeURIComponent(word)}`),

  generateText: (topic: string, level: string, wordCount?: number) =>
    request<GeneratedText>(`${API_BASE}/ai/generate-text`, {
      method: 'POST',
      body: JSON.stringify({ topic, level, wordCount: wordCount ?? null, wordsToInclude: null }),
    }),
  aiUsage: () => request<{ remaining: number }>(`${API_BASE}/ai/usage`),
  translate: (text: string) => request<{ translation: string }>(`${API_BASE}/ai/translate`, {
    method: 'POST',
    body: JSON.stringify({ text }),
  }),

  vocabFronts: () => request<string[]>(`${API_BASE}/vocab/fronts`),

  listReadingTexts: () => request<ReadingText[]>(`${API_BASE}/reading-texts`),
  getReadingText: (id: string) => request<ReadingText>(`${API_BASE}/reading-texts/${id}`),
  createReadingText: (data: {
    title: string; content: string; level?: string; weekId?: string | null;
    generateAudio?: boolean;
    questions?: { type: ReadingQuestionType; prompt: string; options?: string[] | null; correctAnswer?: string | null }[]
  }) =>
    request<ReadingText>(`${API_BASE}/reading-texts`, {
      method: 'POST',
      body: JSON.stringify({
        title: data.title, content: data.content,
        level: data.level ?? null,
        weekId: data.weekId ?? null,
        generateAudio: data.generateAudio ?? true,
        questions: data.questions ?? null,
      }),
    }),
  updateReadingText: (id: string, data: {
    title?: string
    content?: string
    level?: string | null
    weekId?: string | null
    clearWeek?: boolean
    questions?: { type: ReadingQuestionType; prompt: string; options?: string[] | null; correctAnswer?: string | null }[] | null
  }) =>
    request<ReadingText>(`${API_BASE}/reading-texts/${id}`, {
      method: 'PUT',
      body: JSON.stringify({
        title: data.title,
        content: data.content,
        level: data.level ?? null,
        weekId: data.weekId ?? null,
        clearWeek: data.clearWeek ?? false,
        questions: data.questions ?? null,
      }),
    }),
  regeneratePassageAudio: (id: string) =>
    request<ReadingText>(`${API_BASE}/reading-texts/${id}/audio/generate`, { method: 'POST' }),
  deletePassageAudio: (id: string) =>
    request<void>(`${API_BASE}/reading-texts/${id}/audio`, { method: 'DELETE' }),
  uploadPassageAudio: async (id: string, file: File) => {
    const form = new FormData()
    form.append('file', file)
    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData.session?.access_token
    const res = await fetch(`${API_BASE}/reading-texts/${id}/audio`, {
      method: 'POST',
      body: form,
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    if (!res.ok) {
      let msg = res.statusText || `HTTP ${res.status}`
      try { const body = await res.text(); if (body) { try { const j = JSON.parse(body); msg = j.error ?? msg } catch { msg = body } } } catch {}
      throw new ApiError(msg, res.status)
    }
    return res.json() as Promise<ReadingText>
  },
  generateQuestions: (content: string, level?: string, count: number = 4) =>
    request<{ questions: ReadingTextQuestion[] }>(`${API_BASE}/reading-texts/generate-questions`, {
      method: 'POST',
      body: JSON.stringify({ content, level: level ?? null, count }),
    }),
  deleteReadingText: (id: string) => request<void>(`${API_BASE}/reading-texts/${id}`, { method: 'DELETE' }),

  getMe: () => request<UserProfile>(`${API_BASE}/me`),
  updateMe: (displayName?: string, anthropicApiKey?: string) =>
    request<UserProfile>(`${API_BASE}/me`, {
      method: 'PUT',
      body: JSON.stringify({
        displayName: displayName ?? null,
        anthropicApiKey: anthropicApiKey ?? null,
      }),
    }),
  adminListUsers: () => request<UserProfile[]>(`${API_BASE}/admin/users`),
  adminLogsStats: (minutes: number = 60) =>
    request<LogsStats>(`${API_BASE}/admin/logs/stats?minutes=${minutes}`),
  adminLogsDiagnose: (minutes: number = 60) =>
    request<DiagnosticReport>(`${API_BASE}/admin/logs/diagnose?minutes=${minutes}`),
  adminDownloadDiagnostics: async (minutes: number = 60) => {
    const res = await authedFetch(
      `${API_BASE}/admin/logs/snapshot?minutes=${minutes}&recentLogs=200&recentErrors=50`,
    )
    if (!res.ok) throw new ApiError(`Snapshot failed: HTTP ${res.status}`, res.status)
    const blob = await res.blob()
    const cd = res.headers.get('content-disposition') ?? ''
    const m = cd.match(/filename="?([^"]+)"?/i)
    const filename = m?.[1] ?? `diagnostics-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  },
  adminQueryLogs: (params: LogQueryParams) => {
    const q = new URLSearchParams()
    if (params.level) q.set('level', params.level)
    if (params.eventType) q.set('eventType', params.eventType)
    if (params.endpoint) q.set('endpoint', params.endpoint)
    if (params.traceId) q.set('traceId', params.traceId)
    if (params.userId) q.set('userId', params.userId)
    if (params.minDurationMs) q.set('minDurationMs', String(params.minDurationMs))
    if (params.since) q.set('since', params.since)
    if (params.page) q.set('page', String(params.page))
    if (params.pageSize) q.set('pageSize', String(params.pageSize))
    return request<LogsPage>(`${API_BASE}/admin/logs?${q.toString()}`)
  },
  adminActivityLogs: (params: ActivityLogParams = {}) => {
    const q = new URLSearchParams()
    if (params.eventType) q.set('eventType', params.eventType)
    if (params.userId) q.set('userId', params.userId)
    if (params.search) q.set('search', params.search)
    if (params.since) q.set('since', params.since)
    if (params.until) q.set('until', params.until)
    if (params.page) q.set('page', String(params.page))
    if (params.pageSize) q.set('pageSize', String(params.pageSize))
    return request<ActivityLogsPage>(`${API_BASE}/admin/logs/activity?${q.toString()}`)
  },
  adminActivityTypes: (days: number = 30) =>
    request<ActivityTypeCount[]>(`${API_BASE}/admin/logs/activity/types?days=${days}`),
  trackPageView: (path: string, label: string) =>
    authedFetch(`${API_BASE}/client-metrics/page-view`, {
      method: 'POST',
      body: JSON.stringify({ path, label }),
      keepalive: true,
    }).catch(() => { /* best-effort telemetry */ }),
  adminSetUserRole: (id: string, role: UserRole) =>
    request<UserProfile>(`${API_BASE}/admin/users/${id}/role`, {
      method: 'PUT',
      body: JSON.stringify({ role }),
    }),
  adminDeleteUser: (id: string) =>
    request<void>(`${API_BASE}/admin/users/${id}`, { method: 'DELETE' }),
}

export function parseBulkText(text: string): { front: string; back: string }[] {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0)
  return lines.map(line => {
    let parts: string[] | null = null
    if (line.includes('\t')) parts = line.split('\t', 2)
    else if (line.includes(' - ')) {
      const idx = line.indexOf(' - ')
      parts = [line.substring(0, idx), line.substring(idx + 3)]
    } else if (line.includes(' | ')) {
      const idx = line.indexOf(' | ')
      parts = [line.substring(0, idx), line.substring(idx + 3)]
    } else if (line.includes(',')) {
      parts = [line.substring(0, line.indexOf(',')), line.substring(line.indexOf(',') + 1)]
    }
    if (!parts || parts.length < 2) return { front: line, back: '' }
    return { front: parts[0].trim(), back: parts[1].trim() }
  }).filter(c => c.front.length > 0)
}
