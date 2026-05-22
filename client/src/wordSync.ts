const WORD_RE = /([A-Za-zäöüÄÖÜß]+)([.,!?;:]*)/g

const SPACE_WEIGHT = 1
const COMMA_PAUSE = 1
const SENTENCE_PAUSE = 3

export function buildWordTimings(content: string, durationSec: number): number[] {
  if (!content || durationSec <= 0) return []
  const weights: number[] = []
  let total = 0
  for (const m of content.matchAll(WORD_RE)) {
    const word = m[1]
    const punct = m[2] ?? ''
    let w = word.length + SPACE_WEIGHT
    if (punct.includes('.') || punct.includes('!') || punct.includes('?')) w += SENTENCE_PAUSE
    else if (punct.includes(',') || punct.includes(';') || punct.includes(':')) w += COMMA_PAUSE
    weights.push(w)
    total += w
  }
  if (weights.length === 0 || total === 0) return []

  const times: number[] = new Array(weights.length)
  let t = 0
  for (let i = 0; i < weights.length; i++) {
    times[i] = t
    t += (weights[i] / total) * durationSec
  }
  return times
}

export function wordAtTime(times: number[], currentTime: number): number {
  const n = times.length
  if (n === 0 || currentTime < 0 || currentTime < times[0]) return -1
  let lo = 0, hi = n - 1
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (times[mid] <= currentTime) lo = mid
    else hi = mid - 1
  }
  return lo
}
