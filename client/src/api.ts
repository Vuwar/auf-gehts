import { supabase } from './supabase'

const API_BASE = `${(import.meta.env.VITE_API_URL as string) ?? ''}/api`

export interface Week {
  id: string
  number: number
  title: string
  description: string | null
  setCount: number
  completedCount: number
}

export interface WeekDetail {
  id: string
  number: number
  title: string
  description: string | null
  sets: WordSet[]
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

export interface ReadingText {
  id: string
  title: string
  content: string
  level: string | null
  createdByUserId: string | null
  createdByName: string | null
  isPublic: boolean
  isOwner: boolean
  createdAt: string
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
  stats: Stats
  weeks: Week[]
  currentStreak: number
  longestStreak: number
  friends: FriendProgress[]
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

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  inflight++
  notifyLoading()
  try {
  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData.session?.access_token
  let res: Response
  try {
    res = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options?.headers,
      },
    })
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
  }
}

export const api = {
  getStats: () => request<Stats>(`${API_BASE}/stats`),
  getDashboard: () => request<Dashboard>(`${API_BASE}/dashboard`),

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
    request<void>(`${API_BASE}/sets/${idOrSlug}/progress`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    }),
  setFavorite: (idOrSlug: string, isFavorite: boolean) =>
    request<void>(`${API_BASE}/sets/${idOrSlug}/favorite`, {
      method: 'PUT',
      body: JSON.stringify({ isFavorite }),
    }),
  searchSets: (q?: string) =>
    request<WordSet[]>(`${API_BASE}/sets/search${q ? `?q=${encodeURIComponent(q)}` : ''}`),

  listWords: (idOrSlug: string) => request<Word[]>(`${API_BASE}/sets/${idOrSlug}/words`),
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
  createReadingText: (data: { title: string; content: string; level?: string; isPublic?: boolean }) =>
    request<ReadingText>(`${API_BASE}/reading-texts`, {
      method: 'POST',
      body: JSON.stringify({
        title: data.title, content: data.content,
        level: data.level ?? null, isPublic: data.isPublic ?? true,
      }),
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
