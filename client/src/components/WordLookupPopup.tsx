import { useEffect, useState } from 'react'
import { api, type WordLookup } from '../api'
import SpeakerIcon from './SpeakerIcon'
import { speakGerman } from '../tts'
import { PopupSkeleton } from './Skeletons'

interface Props {
  word: string
  sentence: string | null
  anchorRect: DOMRect | null
  onClose: () => void
  onSaved: (front: string) => void
}

export default function WordLookupPopup({ word, sentence, anchorRect, onClose, onSaved }: Props) {
  const [lookup, setLookup] = useState<WordLookup | null>(null)
  const [loading, setLoading] = useState(true)
  const [overrideBack, setOverrideBack] = useState('')
  const [savedMsg, setSavedMsg] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true); setLookup(null); setOverrideBack(''); setSavedMsg(null)
    api.lookupWord(word).then(r => {
      if (cancelled) return
      setLookup(r)
      setOverrideBack(r.translation ?? '')
    }).catch(() => {}).finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [word])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const save = async () => {
    if (!lookup) return
    const front = lookup.gender ? `${lookup.gender} ${lookup.word}` : lookup.word
    const back = overrideBack.trim() || lookup.translation || ''
    if (!back) { setSavedMsg('Add a translation'); return }
    setSaving(true)
    try {
      await api.saveToVocab(front, back, sentence ?? undefined)
      onSaved(front)
      setSavedMsg(`Saved "${front}"`)
      setTimeout(() => onClose(), 900)
    } catch (e: any) {
      setSavedMsg(e.message)
    } finally {
      setSaving(false)
    }
  }

  const style: React.CSSProperties = (() => {
    if (!anchorRect) return { position: 'fixed', top: 80, left: 16 }
    const popupWidth = 320
    const estimatedHeight = 260
    const margin = 8
    const left = Math.max(margin, Math.min(window.innerWidth - popupWidth - margin, anchorRect.left))
    const below = anchorRect.bottom + margin
    const fitsBelow = below + estimatedHeight <= window.innerHeight - margin
    const top = fitsBelow
      ? below
      : Math.max(margin, anchorRect.top - estimatedHeight - margin)
    return { position: 'fixed', top, left }
  })()

  return (
    <>
      <div className="word-popup-backdrop" onClick={onClose} />
      <div className="word-popup" style={style} onClick={e => e.stopPropagation()}>
        {loading ? (
          <PopupSkeleton />
        ) : !lookup ? (
          <p className="empty-state" style={{ margin: 0 }}>No data for "{word}".</p>
        ) : (
          <>
            <div className="lookup-header">
              <strong>{lookup.gender ? `${lookup.gender} ` : ''}{lookup.word}</strong>
              <button onClick={() => speakGerman(lookup.word)} className="word-speaker" aria-label="Speak"><SpeakerIcon /></button>
              {lookup.plural && <span className="hint">plural: {lookup.plural}</span>}
            </div>
            {lookup.translation && <p style={{ margin: '4px 0' }}>→ {lookup.translation}</p>}
            {lookup.definitions.length > 0 && (
              <ul className="lookup-defs">
                {lookup.definitions.slice(0, 2).map((d, i) => (
                  <li key={i}><em>{d.partOfSpeech}:</em> {d.definition}</li>
                ))}
              </ul>
            )}
            <div className="form-row" style={{ marginTop: '8px' }}>
              <input type="text" placeholder="Translation" value={overrideBack} onChange={e => setOverrideBack(e.target.value)} />
              <button onClick={save} disabled={saving} className="deck-btn primary">
                {saving ? 'Saving...' : 'Save to vocab'}
              </button>
              {savedMsg && <p style={{ color: 'var(--accent)', fontSize: '12px', margin: 0 }}>{savedMsg}</p>}
            </div>
          </>
        )}
      </div>
    </>
  )
}
