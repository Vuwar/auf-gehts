import { useEffect, useRef, useState } from 'react'

interface Props {
  src: string
  onEnded?: () => void
}

const SPEEDS = [0.75, 1, 1.25, 1.5]

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export default function AudioPlayer({ src, onEnded }: Props) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [current, setCurrent] = useState(0)
  const [duration, setDuration] = useState(0)
  const [speed, setSpeed] = useState(1)
  const [muted, setMuted] = useState(false)
  const [buffering, setBuffering] = useState(false)

  useEffect(() => {
    const a = audioRef.current
    if (!a) return
    a.playbackRate = speed
  }, [speed])

  useEffect(() => {
    setCurrent(0)
    setDuration(0)
    setPlaying(false)
  }, [src])

  const togglePlay = () => {
    const a = audioRef.current
    if (!a) return
    if (playing) {
      a.pause()
    } else {
      a.play().catch(() => {})
    }
  }

  const onSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const a = audioRef.current
    if (!a) return
    const next = Number(e.target.value)
    a.currentTime = next
    setCurrent(next)
  }

  const skip = (delta: number) => {
    const a = audioRef.current
    if (!a) return
    a.currentTime = Math.max(0, Math.min(duration, a.currentTime + delta))
  }

  const cycleSpeed = () => {
    const idx = SPEEDS.indexOf(speed)
    setSpeed(SPEEDS[(idx + 1) % SPEEDS.length])
  }

  const toggleMute = () => {
    const a = audioRef.current
    if (!a) return
    a.muted = !a.muted
    setMuted(a.muted)
  }

  const progressPct = duration > 0 ? (current / duration) * 100 : 0

  return (
    <div className="audio-player" data-playing={playing}>
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={e => setCurrent((e.target as HTMLAudioElement).currentTime)}
        onLoadedMetadata={e => setDuration((e.target as HTMLAudioElement).duration)}
        onDurationChange={e => setDuration((e.target as HTMLAudioElement).duration)}
        onWaiting={() => setBuffering(true)}
        onPlaying={() => setBuffering(false)}
        onCanPlay={() => setBuffering(false)}
        onEnded={() => { setPlaying(false); onEnded?.() }}
      />

      <div className="audio-player-main">
        <button
          type="button"
          className="audio-player-play"
          onClick={togglePlay}
          aria-label={playing ? 'Pause' : 'Play'}
        >
          {buffering ? (
            <span className="audio-player-spinner" aria-hidden="true" />
          ) : playing ? (
            <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true">
              <rect x="6" y="5" width="4" height="14" rx="1" />
              <rect x="14" y="5" width="4" height="14" rx="1" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true">
              <path d="M8 5v14l11-7-11-7z" />
            </svg>
          )}
        </button>

        <div className="audio-player-body">
          <div className="audio-player-row">
            <span className="audio-player-time">{formatTime(current)}</span>
            <div className="audio-player-track">
              <div className="audio-player-track-fill" style={{ width: `${progressPct}%` }} />
              <input
                type="range"
                min={0}
                max={duration || 0}
                step={0.1}
                value={current}
                onChange={onSeek}
                aria-label="Seek"
              />
            </div>
            <span className="audio-player-time">{formatTime(duration)}</span>
          </div>
        </div>
      </div>

      <div className="audio-player-controls">
        <button type="button" className="audio-player-control" onClick={() => skip(-10)} aria-label="Back 10 seconds">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M11 17l-5-5 5-5" />
            <path d="M18 17l-5-5 5-5" />
          </svg>
          <span>10s</span>
        </button>
        <button type="button" className="audio-player-control" onClick={() => skip(10)} aria-label="Forward 10 seconds">
          <span>10s</span>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M13 17l5-5-5-5" />
            <path d="M6 17l5-5-5-5" />
          </svg>
        </button>
        <button type="button" className="audio-player-control audio-player-speed" onClick={cycleSpeed} aria-label={`Playback speed ${speed}x`}>
          {speed}×
        </button>
        <button type="button" className="audio-player-control" onClick={toggleMute} aria-label={muted ? 'Unmute' : 'Mute'}>
          {muted ? (
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              <line x1="23" y1="9" x2="17" y2="15" />
              <line x1="17" y1="9" x2="23" y2="15" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
            </svg>
          )}
        </button>
      </div>
    </div>
  )
}
