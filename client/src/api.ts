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
  isOwner: boolean
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
  active: WordSet[]
  completed: WordSet[]
  mine: WordSet[]
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

export interface UserProfile {
  id: string
  email: string
  displayName: string | null
  hasAnthropicKey: boolean
  createdAt: string
  lastSeenAt: string
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData.session?.access_token
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  })
  if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`)
  if (res.status === 204) return undefined as T
  return res.json()
}

export const api = {
  getStats: () => request<Stats>(`${API_BASE}/stats`),

  listWeeks: () => request<Week[]>(`${API_BASE}/weeks`),
  getWeek: (idOrNumber: string | number) => request<WeekDetail>(`${API_BASE}/weeks/${idOrNumber}`),

  getLibrary: () => request<Library>(`${API_BASE}/sets/library`),
  getSet: (idOrSlug: string) => request<WordSet>(`${API_BASE}/sets/${idOrSlug}`),
  createSet: (data: { weekId?: string; name: string; description?: string; level?: string; isPublic: boolean }) =>
    request<WordSet>(`${API_BASE}/sets`, {
      method: 'POST',
      body: JSON.stringify({
        weekId: data.weekId ?? null,
        name: data.name,
        description: data.description ?? null,
        level: data.level ?? null,
        isPublic: data.isPublic,
      }),
    }),
  deleteSet: (id: string) => request<void>(`${API_BASE}/sets/${id}`, { method: 'DELETE' }),

  setProgress: (idOrSlug: string, status: 'NotStarted' | 'Active' | 'Completed') =>
    request<void>(`${API_BASE}/sets/${idOrSlug}/progress`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    }),

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

  getMe: () => request<UserProfile>(`${API_BASE}/me`),
  updateMe: (displayName?: string, anthropicApiKey?: string) =>
    request<UserProfile>(`${API_BASE}/me`, {
      method: 'PUT',
      body: JSON.stringify({
        displayName: displayName ?? null,
        anthropicApiKey: anthropicApiKey ?? null,
      }),
    }),
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
