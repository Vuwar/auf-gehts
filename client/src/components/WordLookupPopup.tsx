import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { api, type WordLookup } from '../api'
import SpeakerIcon from './SpeakerIcon'
import { speakGerman } from '../tts'
import { PopupSkeleton } from './Skeletons'

interface Props {
  word: string
  sentence: string | null
  anchorEl: HTMLElement | null
  onClose: () => void
  onSaved: (front: string) => void
}

const POPUP_WIDTH = 320
const MARGIN = 8

export default function WordLookupPopup({ word, sentence, anchorEl, onClose, onSaved }: Props) {
  const [lookup, setLookup] = useState<WordLookup | null>(null)
  const [loading, setLoading] = useState(true)
  const [overrideBack, setOverrideBack] = useState('')
  const [editingBack, setEditingBack] = useState(false)
  const [savedMsg, setSavedMsg] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [position, setPosition] = useState<{ top: number; left: number }>({ top: 80, left: 16 })
  const popupRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true); setLookup(null); setOverrideBack(''); setEditingBack(false); setSavedMsg(null)
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

  const reposition = useCallback(() => {
    if (!anchorEl) return
    const rect = anchorEl.getBoundingClientRect()
    const popupH = popupRef.current?.offsetHeight ?? 260
    const left = Math.max(MARGIN, Math.min(window.innerWidth - POPUP_WIDTH - MARGIN, rect.left))
    const below = rect.bottom + MARGIN
    const fitsBelow = below + popupH <= window.innerHeight - MARGIN
    const top = fitsBelow
      ? below
      : Math.max(MARGIN, rect.top - popupH - MARGIN)
    setPosition({ top, left })
  }, [anchorEl])

  useLayoutEffect(() => { reposition() }, [reposition, lookup])

  useEffect(() => {
    if (!anchorEl) return
    reposition()
    const onScroll = () => reposition()
    const onResize = () => reposition()
    window.addEventListener('scroll', onScroll, { passive: true, capture: true })
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('scroll', onScroll, { capture: true } as any)
      window.removeEventListener('resize', onResize)
    }
  }, [anchorEl, reposition])

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

  const style: React.CSSProperties = { position: 'fixed', top: position.top, left: position.left, width: POPUP_WIDTH }

  return (
    <>
      <div className="word-popup-backdrop" onClick={onClose} />
      <div className="word-popup" ref={popupRef} style={style} onClick={e => e.stopPropagation()}>
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
            {lookup.definitions.length > 0 && (
              <ul className="lookup-defs">
                {lookup.definitions.slice(0, 2).map((d, i) => (
                  <li key={i}><em>{d.partOfSpeech}:</em> {d.definition}</li>
                ))}
              </ul>
            )}
            <div className="form-row" style={{ marginTop: '8px' }}>
              <div className="word-popup-translation">
                <span className="card-label">Translation</span>
                <div className={`word-popup-translation-row${editingBack ? ' is-editing' : ''}`}>
                  <input
                    type="text"
                    value={overrideBack}
                    onChange={e => setOverrideBack(e.target.value)}
                    readOnly={!editingBack}
                    aria-readonly={!editingBack}
                    className="word-popup-translation-input"
                  />
                  <button
                    type="button"
                    onClick={() => setEditingBack(v => !v)}
                    className="word-popup-edit-btn"
                    aria-label={editingBack ? 'Lock translation' : 'Edit translation'}
                    title={editingBack ? 'Lock translation' : 'Edit translation'}
                  >
                    {editingBack ? (
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <rect x="4" y="11" width="16" height="10" rx="2" />
                        <path d="M8 11V7a4 4 0 0 1 8 0v4" />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <path d="M12 20h9" />
                        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
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
