import { useEffect, useMemo, useState } from 'react'
import { api, type WordLookup, type ReadingText } from '../api'
import ErrorView from './ErrorView'
import SpeakerIcon from './SpeakerIcon'
import { speakGerman } from '../tts'

type Mode = 'paste' | 'generate' | 'library'

export default function Reader() {
  const [mode, setMode] = useState<Mode>('paste')

  // Separate paste vs generated state
  const [pastedText, setPastedText] = useState('')
  const [generatedText, setGeneratedText] = useState('')

  const [topic, setTopic] = useState('')
  const [level, setLevel] = useState('A2')
  const [wordCount, setWordCount] = useState(150)
  const [generating, setGenerating] = useState(false)
  const [generateError, setGenerateError] = useState<unknown>(null)
  const [remaining, setRemaining] = useState<number | null>(null)

  const [selectedWord, setSelectedWord] = useState<string | null>(null)
  const [selectedSentence, setSelectedSentence] = useState<string | null>(null)
  const [lookup, setLookup] = useState<WordLookup | null>(null)
  const [lookingUp, setLookingUp] = useState(false)
  const [overrideBack, setOverrideBack] = useState('')
  const [savedMsg, setSavedMsg] = useState<string | null>(null)

  const [translation, setTranslation] = useState<string | null>(null)
  const [translating, setTranslating] = useState(false)

  const [vocabFronts, setVocabFronts] = useState<Set<string>>(new Set())
  const [sharedTexts, setSharedTexts] = useState<ReadingText[]>([])
  const [librarySearch, setLibrarySearch] = useState('')

  // Active text = the one user is currently reading
  const activeText = mode === 'generate' ? generatedText : pastedText

  useEffect(() => {
    api.aiUsage().then(u => setRemaining(u.remaining)).catch(() => {})
    api.vocabFronts().then(list => setVocabFronts(new Set(list.map(f => normalize(f))))).catch(() => {})
    api.listReadingTexts().then(setSharedTexts).catch(() => {})
  }, [])

  const generate = async () => {
    if (!topic.trim()) return
    setGenerating(true)
    setGenerateError(null)
    try {
      const result = await api.generateText(topic.trim(), level, wordCount)
      setGeneratedText(result.text)
      if (result.remainingToday >= 0) setRemaining(result.remainingToday)
    } catch (e) {
      setGenerateError(e)
    } finally {
      setGenerating(false)
    }
  }

  const translate = async () => {
    if (!activeText.trim()) return
    setTranslating(true)
    try {
      const r = await api.translate(activeText)
      setTranslation(r.translation)
    } catch (e: any) {
      alert(e.message)
    } finally {
      setTranslating(false)
    }
  }

  const loadSharedText = (t: ReadingText) => {
    setPastedText(t.content)
    setMode('paste')
    setTranslation(null)
  }

  const saveText = async () => {
    if (!pastedText.trim()) return
    const title = prompt('Title for this text?')
    if (!title?.trim()) return
    try {
      const t = await api.createReadingText({ title: title.trim(), content: pastedText, isPublic: true })
      setSharedTexts([t, ...sharedTexts])
      alert('Shared with everyone')
    } catch (e: any) {
      alert(e.message)
    }
  }

  const renderText = () => {
    if (!activeText) return null
    const sentences = activeText.split(/(?<=[.!?])\s+/)
    return (
      <div className="reader-text">
        {sentences.map((sentence, sIdx) => (
          <span key={sIdx}>
            {tokenize(sentence).map((tok, i) => {
              if (tok.isWord) {
                const isSelected = selectedWord?.toLowerCase() === tok.text.toLowerCase()
                const isSaved = vocabFronts.has(normalize(tok.text))
                return (
                  <span
                    key={i}
                    className={`reader-word ${isSelected ? 'selected' : ''} ${isSaved ? 'saved' : ''}`}
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
    setVocabFronts(new Set([...vocabFronts, normalize(lookup.word)]))
    setSavedMsg(`Saved "${front}" to My Vocabulary`)
    setTimeout(() => setSavedMsg(null), 2500)
  }

  const filteredShared = useMemo(() => {
    const q = librarySearch.toLowerCase().trim()
    if (!q) return sharedTexts
    return sharedTexts.filter(t => t.title.toLowerCase().includes(q))
  }, [sharedTexts, librarySearch])

  return (
    <div className="deck reader-layout">
      <div className="reader-main">
        <div className="deck-header"><h1>Reader</h1></div>

        <div className="tab-toggle">
          <button onClick={() => setMode('paste')} className={`tab-toggle-btn ${mode === 'paste' ? 'active' : ''}`}>Paste text</button>
          <button onClick={() => setMode('generate')} className={`tab-toggle-btn ${mode === 'generate' ? 'active' : ''}`}>Generate with AI</button>
          <button onClick={() => setMode('library')} className={`tab-toggle-btn ${mode === 'library' ? 'active' : ''}`}>Library</button>
        </div>

        {mode === 'paste' && (
          <div className="form-row">
            <p className="hint">Paste German text. Click any word to look it up. Saved words are highlighted.</p>
            <textarea value={pastedText} onChange={e => { setPastedText(e.target.value); setTranslation(null) }} rows={6} placeholder="Paste German text here..." />
            {pastedText.trim() && (
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button onClick={translate} disabled={translating} className="deck-btn">
                  {translating ? 'Translating...' : '🌐 Show translation'}
                </button>
                <button onClick={saveText} className="deck-btn">📤 Share text</button>
              </div>
            )}
            {translation && (
              <div className="reader-translation">
                <span className="card-label">English translation</span>
                <p>{translation}</p>
                <button onClick={() => setTranslation(null)} className="deck-btn" style={{ alignSelf: 'flex-start', marginTop: '6px' }}>Hide</button>
              </div>
            )}
          </div>
        )}

        {mode === 'generate' && (
          <div className="form-row">
            <p className="hint">
              AI generates text using Llama 3.3 via Groq.
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
            {generateError !== null && <ErrorView error={generateError} context="ai" compact onRetry={() => { setGenerateError(null); generate() }} />}
            {generatedText && (
              <div className="form-row" style={{ marginTop: '8px' }}>
                <p className="hint">Generated text:</p>
                <textarea value={generatedText} onChange={e => setGeneratedText(e.target.value)} rows={6} />
                <button onClick={translate} disabled={translating} className="deck-btn" style={{ alignSelf: 'flex-start' }}>
                  {translating ? 'Translating...' : '🌐 Show translation'}
                </button>
                {translation && (
                  <div className="reader-translation">
                    <span className="card-label">English translation</span>
                    <p>{translation}</p>
                    <button onClick={() => setTranslation(null)} className="deck-btn" style={{ alignSelf: 'flex-start', marginTop: '6px' }}>Hide</button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {mode === 'library' && (
          <div className="form-row">
            <p className="hint">Texts shared by everyone. Pick one to read + save words.</p>
            <input type="text" placeholder="Search titles..." value={librarySearch} onChange={e => setLibrarySearch(e.target.value)} />
            {filteredShared.length === 0 ? (
              <p className="empty-state">No shared texts yet.</p>
            ) : (
              <ul className="deck-list">
                {filteredShared.map(t => (
                  <li key={t.id} className="deck-item">
                    <button onClick={() => loadSharedText(t)} className="deck-item-main">
                      <strong>{t.title}</strong>
                      <div className="hint" style={{ marginTop: '4px' }}>
                        {t.createdByName ?? 'Unknown'} · {t.content.length} chars
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {activeText && mode !== 'library' && renderText()}
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
              <button onClick={() => speakGerman(lookup.word)} className="word-speaker" aria-label="Speak"><SpeakerIcon /></button>
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

function normalize(s: string): string {
  return s.toLowerCase().replace(/^(der|die|das)\s+/, '').trim()
}
