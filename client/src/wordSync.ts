export function buildWordTimings(content: string, durationSec: number): number[] {
  const words = Array.from(content.matchAll(/[A-Za-zäöüÄÖÜß]+/g)).map(m => m[0])
  if (words.length === 0 || durationSec <= 0) return []
  const totalLen = words.reduce((s, w) => s + w.length, 0)
  if (totalLen === 0) return []
  const times: number[] = []
  let t = 0
  for (const w of words) {
    times.push(t)
    t += (w.length / totalLen) * durationSec
  }
  return times
}

export function wordAtTime(times: number[], currentTime: number): number {
  if (times.length === 0 || currentTime < 0) return -1
  let lo = 0, hi = times.length - 1
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (times[mid] <= currentTime) lo = mid
    else hi = mid - 1
  }
  return times[lo] <= currentTime ? lo : -1
}
