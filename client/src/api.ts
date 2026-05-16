const API_BASE = '/api'

export interface Deck {
  id: string
  name: string
  createdAt: string
  flashCards?: FlashCard[]
}

export interface FlashCard {
  id: string
  deckId: string
  front: string
  back: string
  createdAt: string
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options?.headers },
  })
  if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`)
  if (res.status === 204) return undefined as T
  return res.json()
}

export const api = {
  listDecks: () => request<Deck[]>(`${API_BASE}/decks`),
  getDeck: (id: string) => request<Deck>(`${API_BASE}/decks/${id}`),
  createDeck: (name: string) =>
    request<Deck>(`${API_BASE}/decks`, { method: 'POST', body: JSON.stringify({ name }) }),
  deleteDeck: (id: string) =>
    request<void>(`${API_BASE}/decks/${id}`, { method: 'DELETE' }),
  listCards: (deckId: string) =>
    request<FlashCard[]>(`${API_BASE}/decks/${deckId}/flashcards`),
  createCard: (deckId: string, front: string, back: string) =>
    request<FlashCard>(`${API_BASE}/decks/${deckId}/flashcards`, {
      method: 'POST',
      body: JSON.stringify({ front, back }),
    }),
  deleteCard: (id: string) =>
    request<void>(`${API_BASE}/flashcards/${id}`, { method: 'DELETE' }),
}
