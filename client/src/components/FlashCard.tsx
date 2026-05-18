import { useEffect, useState } from 'react'
import { speakGerman, stopSpeaking, ttsAvailable } from '../tts'

interface FlashCardProps {
  front: string
  back: string
}

export default function FlashCard({ front, back }: FlashCardProps) {
  const [flipped, setFlipped] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const [error, setError] = useState(false)
  const canSpeak = ttsAvailable()

  useEffect(() => () => { stopSpeaking() }, [])
  useEffect(() => { stopSpeaking(); setSpeaking(false) }, [front])

  const speak = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (speaking) {
      stopSpeaking()
      setSpeaking(false)
      return
    }
    setError(false)
    speakGerman(front, {
      onStart: () => setSpeaking(true),
      onEnd: () => setSpeaking(false),
      onError: () => {
        setSpeaking(false)
        setError(true)
        setTimeout(() => setError(false), 2000)
      },
    })
  }

  return (
    <div
      className="flashcard-container"
      onClick={() => setFlipped(f => !f)}
      role="button"
      aria-label={flipped ? 'Show German' : 'Reveal English'}
    >
      <div className={`flashcard ${flipped ? 'flipped' : ''}`}>
        <div className="flashcard-face flashcard-front">
          <span className="card-label">German</span>
          <p className="card-word">{front}</p>
          <span className="card-prompt">click to reveal</span>
        </div>
        <div className="flashcard-face flashcard-back">
          <span className="card-label">English</span>
          <p className="card-word">{back}</p>
          <span className="card-prompt">click to go back</span>
        </div>
      </div>
      {canSpeak && (
        <button
          type="button"
          onClick={speak}
          aria-label={speaking ? 'Stop' : 'Hear pronunciation'}
          className={`flashcard-speaker ${speaking ? 'speaking' : ''}`}
        >
          {speaking ? <SpeakerActiveIcon /> : <SpeakerIcon />}
        </button>
      )}
      {error && <span className="flashcard-tts-error">Audio unavailable</span>}
    </div>
  )
}

function SpeakerIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
    </svg>
  )
}

function SpeakerActiveIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07">
        <animate attributeName="opacity" values="0.3;1;0.3" dur="1s" repeatCount="indefinite" />
      </path>
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14">
        <animate attributeName="opacity" values="0.1;1;0.1" dur="1.2s" repeatCount="indefinite" />
      </path>
    </svg>
  )
}
