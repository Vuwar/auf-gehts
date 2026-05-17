import { playLetter } from '../tts'
import SpeakerIcon from './SpeakerIcon'

const LETTERS = [
  'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J',
  'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T',
  'U', 'V', 'W', 'X', 'Y', 'Z', 'Ä', 'Ö', 'Ü', 'ß',
]

export default function Alphabet() {
  return (
    <div className="deck">
      <div className="deck-header">
        <div>
          <h1>Alphabet</h1>
          <p className="hint">Tap a letter to hear its German pronunciation.</p>
        </div>
      </div>

      <div className="alphabet-grid">
        {LETTERS.map(l => (
          <button key={l} className="letter-card" onClick={() => playLetter(l)}>
            <div className="letter-glyph">{l}</div>
            <span className="letter-speaker"><SpeakerIcon /></span>
          </button>
        ))}
      </div>
    </div>
  )
}
