import { useEffect, useState } from 'react'
import { api, type WordLookup } from '../api'

type Mode = 'paste' | 'generate'

export default function Reader() {
  const [mode, setMode] = useState<Mode>('paste')
  const [text, setText] = useState('')
  const [topic, setTopic] = useState('')
  const [level, setLevel] = useState('A2')
  const [wordCount, setWordCount] = useState(150)
  const [generating, setGenerating] = useState(false)
  const [generateError, setGenerateError] = useState<string | null>(null)
  const [remaining, setRemaining] = useState<number | null>(null)

  const [selectedWord, setSelectedWord] = useState<string | null>(null)
  const [selectedSentence, setSelectedSentence] = useState<string | null>(null)
  const [lookup, setLookup] = useState<WordLookup | null>(null)
  const [lookingUp, setLookingUp] = useState(false)
  const [overrideBack, setOverrideBack] = useState('')
  const [savedMsg, setSavedMsg] = useState<string | null>(null)

  useEffect(() => {
    api.aiUsage().then(u => setRemaining(u.remaining)).catch(() => {})
  }, [])

  const generate = async () => {
    if (!topic.trim()) return
    setGenerating(true)
    setGenerateError(null)
    try {
      const result = await api.generateText(topic.trim(), level, wordCount)
      setText(result.text)
      if (result.remainingToday >= 0) setRemaining(result.remainingToday)
    } catch (e: any) {
      setGenerateError(e.message)
    } finally {
      setGenerating(false)
    }
  }

  const renderText = () => {
    if (!text) return null
    const sentences = text.split(/(?<=[.!?])\s+/)
    return (
      <div className="reader-text">
        {sentences.map((sentence, sIdx) => (
          <span key={sIdx}>
            {tokenize(sentence).map((tok, i) => {
              if (tok.isWord) {
                const isSelected = selectedWord?.toLowerCase() === tok.text.toLowerCase()
                return (
                  <span
                    key={i}
                    className={`reader-word ${isSelected ? 'selected' : ''}`}
                    onClick={() => selectWord(tok.text, sentence.trim())}
                  >
                    {tok.text}
                  </span>
                )
              }
              return <span key={i}>{tok.text}</span>
            })}
            {sIdx < sentences.length - 1 ? ' ' : ''}
          </span>
        ))}
      </div>
    )
  }

  const selectWord = async (word: string, sentence: string) => {
    setSelectedWord(word); setSelectedSentence(sentence)
    setLookup(null); setOverrideBack(''); setSavedMsg(null)
    setLookingUp(true)
    try {
      const result = await api.lookupWord(word)
      setLookup(result)
      setOverrideBack(result.translation ?? '')
    } catch (e) { console.error(e) }
    finally { setLookingUp(false) }
  }

  const save = async () => {
    if (!selectedWord || !lookup) return
    const front = lookup.gender ? `${lookup.gender} ${lookup.word}` : lookup.word
    const back = overrideBack.trim() || lookup.translation || ''
    if (!back) { alert('No translation — type one'); return }
    await api.saveToVocab(front, back, selectedSentence ?? undefined)
    setSavedMsg(`Saved "${front}" to My Vocabulary`)
    setTimeout(() => setSavedMsg(null), 2500)
  }

  return (
    <div className="deck reader-layout">
      <div className="reader-main">
        <div className="deck-header"><h1>Reader</h1></div>

        <div className="tab-toggle">
          <button onClick={() => setMode('paste')} className={`tab-toggle-btn ${mode === 'paste' ? 'active' : ''}`}>Paste text</button>
          <button onClick={() => setMode('generate')} className={`tab-toggle-btn ${mode === 'generate' ? 'active' : ''}`}>Generate with AI</button>
        </div>

        {mode === 'paste' ? (
          <div className="form-row">
            <p className="hint">Paste German text. Click any word to look it up and save to My Vocabulary.</p>
            <textarea value={text} onChange={e => setText(e.target.value)} rows={6} placeholder="Paste German text here..." />
          </div>
        ) : (
          <div className="form-row">
            <p className="hint">
              AI generates text using Claude Haiku.
              {remaining !== null && remaining >= 0 && ` ${remaining} generations remaining today.`}
              {remaining === -1 && ' Using your own API key (unlimited).'}
            </p>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input type="text" placeholder="Topic" value={topic} onChange={e => setTopic(e.target.value)} style={{ flex: 2 }} />
              <select value={level} onChange={e => setLevel(e.target.value)}>
                <option value="A1">A1</option><option value="A2">A2</option><option value="B1">B1</option>
                <option value="B2">B2</option><option value="C1">C1</option><option value="C2">C2</option>
              </select>
              <input type="number" min={50} max={500} step={50} value={wordCount} onChange={e => setWordCount(Number(e.target.value))} style={{ width: '90px' }} />
            </div>
            <button onClick={generate} disabled={generating || !topic.trim()} className="deck-btn primary">
              {generating ? 'Generating...' : 'Generate'}
            </button>
            {generateError && <p style={{ color: 'var(--danger)', fontSize: '13px' }}>{generateError}</p>}
            {text && (
              <div className="form-row" style={{ marginTop: '8px' }}>
                <p className="hint">Generated text:</p>
                <textarea value={text} onChange={e => setText(e.target.value)} rows={6} />
              </div>
            )}
          </div>
        )}

        {text && renderText()}
      </div>

      <aside className="reader-side">
        {!selectedWord ? (
          <p className="empty-state">Click any word to look it up.</p>
        ) : lookingUp ? (
          <p className="empty-state">Looking up "{selectedWord}"...</p>
        ) : lookup ? (
          <div className="reader-side-content">
            <div className="lookup-header">
              <strong>{lookup.gender ? `${lookup.gender} ` : ''}{lookup.word}</strong>
              {lookup.plural && <span className="hint">plural: {lookup.plural}</span>}
            </div>
            {lookup.translation && <p>→ {lookup.translation}</p>}
            {lookup.definitions.length > 0 && (
              <ul className="lookup-defs">
                {lookup.definitions.slice(0, 3).map((d, i) => (
                  <li key={i}><em>{d.partOfSpeech}:</em> {d.definition}</li>
                ))}
              </ul>
            )}
            {selectedSentence && (
              <div className="reader-context">
                <span className="card-label">Context</span>
                <p>{selectedSentence}</p>
              </div>
            )}
            <div className="form-row" style={{ marginTop: '12px' }}>
              <input type="text" placeholder="Back (translation)" value={overrideBack} onChange={e => setOverrideBack(e.target.value)} />
              <button onClick={save} className="deck-btn primary">Save to My Vocabulary</button>
              {savedMsg && <p style={{ color: 'var(--accent)', fontSize: '13px', margin: 0 }}>{savedMsg}</p>}
            </div>
          </div>
        ) : (
          <p className="empty-state">No data found.</p>
        )}
      </aside>
    </div>
  )
}

function tokenize(text: string): { text: string; isWord: boolean }[] {
  const tokens: { text: string; isWord: boolean }[] = []
  const regex = /([A-Za-zäöüÄÖÜß]+)|([^A-Za-zäöüÄÖÜß]+)/g
  let m: RegExpExecArray | null
  while ((m = regex.exec(text)) !== null) {
    if (m[1]) tokens.push({ text: m[1], isWord: true })
    else tokens.push({ text: m[2], isWord: false })
  }
  return tokens
}
