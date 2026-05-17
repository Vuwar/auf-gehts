// Lightweight German TTS helper using browser SpeechSynthesis.
let germanVoice: SpeechSynthesisVoice | null = null

function pickGermanVoice(): SpeechSynthesisVoice | null {
  if (germanVoice) return germanVoice
  const voices = window.speechSynthesis.getVoices()
  germanVoice =
    voices.find(v => v.lang === 'de-DE') ??
    voices.find(v => v.lang?.startsWith('de')) ??
    null
  return germanVoice
}

// Voices load async on some browsers
if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  window.speechSynthesis.onvoiceschanged = () => {
    germanVoice = null
    pickGermanVoice()
  }
}

export function speakGerman(text: string) {
  if (!('speechSynthesis' in window)) return
  window.speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.lang = 'de-DE'
  u.rate = 0.95
  const v = pickGermanVoice()
  if (v) u.voice = v
  window.speechSynthesis.speak(u)
}
