import { useState } from 'react'
import FlashCard from './FlashCard'

interface Card {
  german: string
  english: string
  hint?: string
}

const SAMPLE_CARDS: Card[] = [
  { german: 'der Hund', english: 'the dog', hint: 'masculine' },
  { german: 'die Katze', english: 'the cat', hint: 'feminine' },
  { german: 'das Haus', english: 'the house', hint: 'neuter' },
  { german: 'essen', english: 'to eat' },
  { german: 'trinken', english: 'to drink' },
  { german: 'schlafen', english: 'to sleep' },
  { german: 'die Straße', english: 'the street', hint: 'feminine' },
  { german: 'gut', english: 'good' },
  { german: 'danke', english: 'thank you' },
  { german: 'bitte', english: 'please / you\'re welcome' },
]

export default function FlashCardDeck() {
  const [index, setIndex] = useState(0)

  const prev = () => setIndex(i => Math.max(0, i - 1))
  const next = () => setIndex(i => Math.min(SAMPLE_CARDS.length - 1, i + 1))

  const card = SAMPLE_CARDS[index]

  return (
    <div className="deck">
      <div className="deck-header">
        <h1>Flashcards</h1>
        <p className="deck-progress">
          {index + 1} / {SAMPLE_CARDS.length}
        </p>
      </div>

      <FlashCard key={index} german={card.german} english={card.english} hint={card.hint} />

      <div className="deck-controls">
        <button onClick={prev} disabled={index === 0} className="deck-btn">
          ← Previous
        </button>
        <button onClick={next} disabled={index === SAMPLE_CARDS.length - 1} className="deck-btn">
          Next →
        </button>
      </div>

      <div className="deck-dots">
        {SAMPLE_CARDS.map((_, i) => (
          <button
            key={i}
            className={`dot ${i === index ? 'dot-active' : ''}`}
            onClick={() => setIndex(i)}
            aria-label={`Go to card ${i + 1}`}
          />
        ))}
      </div>
    </div>
  )
}
