import { useState } from 'react'

interface FlashCardProps {
  front: string
  back: string
}

export default function FlashCard({ front, back }: FlashCardProps) {
  const [flipped, setFlipped] = useState(false)

  return (
    <div
      className="flashcard-container"
      onClick={() => setFlipped(f => !f)}
      role="button"
      aria-label={flipped ? 'Show front' : 'Reveal back'}
    >
      <div className={`flashcard ${flipped ? 'flipped' : ''}`}>
        <div className="flashcard-face flashcard-front">
          <span className="card-label">Front</span>
          <p className="card-word">{front}</p>
          <span className="card-prompt">click to reveal</span>
        </div>
        <div className="flashcard-face flashcard-back">
          <span className="card-label">Back</span>
          <p className="card-word">{back}</p>
          <span className="card-prompt">click to go back</span>
        </div>
      </div>
    </div>
  )
}
