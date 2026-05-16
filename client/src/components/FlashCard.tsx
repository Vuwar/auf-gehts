import { useState } from 'react'

interface FlashCardProps {
  german: string
  english: string
  hint?: string
}

export default function FlashCard({ german, english, hint }: FlashCardProps) {
  const [flipped, setFlipped] = useState(false)

  return (
    <div
      className="flashcard-container"
      onClick={() => setFlipped(f => !f)}
      role="button"
      aria-label={flipped ? 'Show German word' : 'Reveal translation'}
    >
      <div className={`flashcard ${flipped ? 'flipped' : ''}`}>
        <div className="flashcard-face flashcard-front">
          <span className="card-label">German</span>
          <p className="card-word">{german}</p>
          {hint && <span className="card-hint">{hint}</span>}
          <span className="card-prompt">click to reveal</span>
        </div>
        <div className="flashcard-face flashcard-back">
          <span className="card-label">English</span>
          <p className="card-word">{english}</p>
          <span className="card-prompt">click to go back</span>
        </div>
      </div>
    </div>
  )
}
