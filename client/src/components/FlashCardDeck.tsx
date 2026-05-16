import { useEffect, useState } from 'react'
import FlashCard from './FlashCard'
import { api, type Deck, type FlashCard as Card } from '../api'

export default function FlashCardDeck() {
  const [decks, setDecks] = useState<Deck[]>([])
  const [selectedDeck, setSelectedDeck] = useState<Deck | null>(null)
  const [cards, setCards] = useState<Card[]>([])
  const [index, setIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [newDeckName, setNewDeckName] = useState('')
  const [newFront, setNewFront] = useState('')
  const [newBack, setNewBack] = useState('')

  useEffect(() => {
    api.listDecks()
      .then(setDecks)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const openDeck = async (deck: Deck) => {
    setSelectedDeck(deck)
    setIndex(0)
    const list = await api.listCards(deck.id)
    setCards(list)
  }

  const createDeck = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newDeckName.trim()) return
    const deck = await api.createDeck(newDeckName.trim())
    setDecks([deck, ...decks])
    setNewDeckName('')
  }

  const deleteDeck = async (id: string) => {
    if (!confirm('Delete this deck?')) return
    await api.deleteDeck(id)
    setDecks(decks.filter(d => d.id !== id))
  }

  const addCard = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedDeck || !newFront.trim() || !newBack.trim()) return
    const card = await api.createCard(selectedDeck.id, newFront.trim(), newBack.trim())
    setCards([...cards, card])
    setNewFront('')
    setNewBack('')
  }

  const deleteCard = async (id: string) => {
    await api.deleteCard(id)
    const updated = cards.filter(c => c.id !== id)
    setCards(updated)
    if (index >= updated.length) setIndex(Math.max(0, updated.length - 1))
  }

  if (loading) return <div className="deck"><p>Loading...</p></div>
  if (error) return <div className="deck"><p style={{ color: 'red' }}>Error: {error}</p></div>

  // Deck list view
  if (!selectedDeck) {
    return (
      <div className="deck">
        <div className="deck-header">
          <h1>Your Decks</h1>
        </div>

        <form onSubmit={createDeck} style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
          <input
            type="text"
            placeholder="New deck name"
            value={newDeckName}
            onChange={e => setNewDeckName(e.target.value)}
            style={{ flex: 1, padding: '0.5rem' }}
          />
          <button type="submit" className="deck-btn">Create</button>
        </form>

        {decks.length === 0 ? (
          <p>No decks yet. Create one above.</p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {decks.map(d => (
              <li key={d.id} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <button onClick={() => openDeck(d)} className="deck-btn" style={{ flex: 1 }}>
                  {d.name}
                </button>
                <button onClick={() => deleteDeck(d.id)} className="deck-btn">×</button>
              </li>
            ))}
          </ul>
        )}
      </div>
    )
  }

  // Card view
  const card = cards[index]

  return (
    <div className="deck">
      <div className="deck-header">
        <button onClick={() => setSelectedDeck(null)} className="deck-btn" style={{ marginBottom: '0.5rem' }}>
          ← Back to decks
        </button>
        <h1>{selectedDeck.name}</h1>
        {cards.length > 0 && (
          <p className="deck-progress">{index + 1} / {cards.length}</p>
        )}
      </div>

      <form onSubmit={addCard} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
        <input
          type="text"
          placeholder="Front"
          value={newFront}
          onChange={e => setNewFront(e.target.value)}
          style={{ padding: '0.5rem' }}
        />
        <input
          type="text"
          placeholder="Back"
          value={newBack}
          onChange={e => setNewBack(e.target.value)}
          style={{ padding: '0.5rem' }}
        />
        <button type="submit" className="deck-btn">Add Card</button>
      </form>

      {cards.length === 0 ? (
        <p>No cards yet. Add one above.</p>
      ) : (
        <>
          <FlashCard key={card.id} front={card.front} back={card.back} />

          <div className="deck-controls">
            <button onClick={() => setIndex(i => Math.max(0, i - 1))} disabled={index === 0} className="deck-btn">
              ← Previous
            </button>
            <button onClick={() => deleteCard(card.id)} className="deck-btn">
              Delete
            </button>
            <button onClick={() => setIndex(i => Math.min(cards.length - 1, i + 1))} disabled={index === cards.length - 1} className="deck-btn">
              Next →
            </button>
          </div>

          <div className="deck-dots">
            {cards.map((_, i) => (
              <button
                key={i}
                className={`dot ${i === index ? 'dot-active' : ''}`}
                onClick={() => setIndex(i)}
                aria-label={`Go to card ${i + 1}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
