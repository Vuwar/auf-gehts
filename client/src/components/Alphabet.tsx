import { speakGerman } from '../tts'
import SpeakerIcon from './SpeakerIcon'

const LETTERS: { letter: string; name: string; example: string }[] = [
  { letter: 'A', name: 'a', example: 'Apfel' },
  { letter: 'B', name: 'be', example: 'Buch' },
  { letter: 'C', name: 'tse', example: 'Computer' },
  { letter: 'D', name: 'de', example: 'Danke' },
  { letter: 'E', name: 'e', example: 'Eis' },
  { letter: 'F', name: 'eff', example: 'Freund' },
  { letter: 'G', name: 'ge', example: 'Gut' },
  { letter: 'H', name: 'ha', example: 'Haus' },
  { letter: 'I', name: 'i', example: 'Idee' },
  { letter: 'J', name: 'yot', example: 'Ja' },
  { letter: 'K', name: 'ka', example: 'Katze' },
  { letter: 'L', name: 'ell', example: 'Liebe' },
  { letter: 'M', name: 'emm', example: 'Mutter' },
  { letter: 'N', name: 'enn', example: 'Nacht' },
  { letter: 'O', name: 'o', example: 'Oma' },
  { letter: 'P', name: 'pe', example: 'Papier' },
  { letter: 'Q', name: 'ku', example: 'Quelle' },
  { letter: 'R', name: 'err', example: 'Rot' },
  { letter: 'S', name: 'ess', example: 'Sonne' },
  { letter: 'T', name: 'te', example: 'Tag' },
  { letter: 'U', name: 'u', example: 'Uhr' },
  { letter: 'V', name: 'fau', example: 'Vater' },
  { letter: 'W', name: 've', example: 'Wasser' },
  { letter: 'X', name: 'iks', example: 'Xylophon' },
  { letter: 'Y', name: 'üpsilon', example: 'Yoga' },
  { letter: 'Z', name: 'tsett', example: 'Zeit' },
  { letter: 'Ä', name: 'ä (ae)', example: 'Bär' },
  { letter: 'Ö', name: 'ö (oe)', example: 'Öl' },
  { letter: 'Ü', name: 'ü (ue)', example: 'Über' },
  { letter: 'ß', name: 'eszett', example: 'Straße' },
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
          <button key={l.letter} className="letter-card" onClick={() => speakGerman(`${l.letter}. Wie in ${l.example}`)}>
            <div className="letter-glyph">{l.letter}</div>
            <div className="letter-info">
              <span className="letter-name">{l.name}</span>
              <span className="letter-example">{l.example}</span>
            </div>
            <span className="letter-speaker"><SpeakerIcon /></span>
          </button>
        ))}
      </div>
    </div>
  )
}
