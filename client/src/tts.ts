const LETTER_AUDIO: Record<string, string> = {
  A: 'A', B: 'B', C: 'C', D: 'D', E: 'E', F: 'F', G: 'G', H: 'H',
  I: 'I', J: 'J', K: 'K', L: 'L', M: 'M', N: 'N', O: 'O', P: 'P',
  Q: 'Q', R: 'R', S: 'S', T: 'T', U: 'U', V: 'V', W: 'W', X: 'X',
  Y: 'Y', Z: 'Z',
  'Ä': 'AE', 'Ö': 'OE', 'Ü': 'UE', 'ß': 'SS',
}

let currentAudio: HTMLAudioElement | null = null

function isMobile(): boolean {
  if (typeof navigator === 'undefined') return false
  return /Android|iPhone|iPad|iPod|Mobi/i.test(navigator.userAgent)
}

export function playLetter(letter: string): boolean {
  if (isMobile()) {
    speakGerman(letter)
    return true
  }
  const key = LETTER_AUDIO[letter]
  if (!key) {
    speakGerman(letter)
    return true
  }
  if (currentAudio) {
    currentAudio.pause()
    currentAudio = null
  }
  if ('speechSynthesis' in window) window.speechSynthesis.cancel()
  const a = new Audio(`/audio/letters/${key}.ogg`)
  currentAudio = a
  a.play().catch(() => {
    currentAudio = null
    speakGerman(letter)
  })
  return true
}

let germanVoice: SpeechSynthesisVoice | null = null
let voiceResolved = false

function pickGermanVoice(): SpeechSynthesisVoice | null {
  if (voiceResolved) return germanVoice
  const voices = window.speechSynthesis.getVoices()
  if (!voices.length) return null
  const de = voices.filter(v => v.lang === 'de-DE' || v.lang?.startsWith('de'))
  germanVoice =
    de.find(v => v.localService && /female|anna|petra|marlene/i.test(v.name)) ??
    de.find(v => v.localService) ??
    de.find(v => /female|anna|petra|marlene/i.test(v.name)) ??
    de[0] ?? null
  voiceResolved = true
  return germanVoice
}

if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  window.speechSynthesis.onvoiceschanged = () => {
    voiceResolved = false
    pickGermanVoice()
  }
  pickGermanVoice()
}

export function ttsAvailable(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

export interface SpeakOptions {
  onStart?: () => void
  onEnd?: () => void
  onError?: () => void
}

export function speakGerman(text: string, opts?: SpeakOptions) {
  if (!ttsAvailable()) { opts?.onError?.(); return }
  window.speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.lang = 'de-DE'
  u.rate = 0.92
  u.pitch = 1.0
  const v = pickGermanVoice()
  if (v) u.voice = v
  if (opts?.onStart) u.onstart = () => opts.onStart!()
  if (opts?.onEnd) u.onend = () => opts.onEnd!()
  u.onerror = () => opts?.onError?.()
  window.speechSynthesis.speak(u)
}

export function stopSpeaking() {
  if (ttsAvailable()) window.speechSynthesis.cancel()
}
