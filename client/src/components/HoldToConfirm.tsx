import { useEffect, useRef, useState, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  hint?: string
  durationMs?: number
  className?: string
  onConfirm: () => void
}

export default function HoldToConfirm({ children, hint, durationMs = 900, className, onConfirm }: Props) {
  const [holding, setHolding] = useState(false)
  const [progress, setProgress] = useState(0)
  const rafRef = useRef<number | null>(null)
  const startRef = useRef<number>(0)
  const confirmedRef = useRef(false)

  const cleanup = () => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    rafRef.current = null
    setHolding(false)
    setProgress(0)
  }

  const start = () => {
    confirmedRef.current = false
    setHolding(true)
    startRef.current = performance.now()
    const tick = (now: number) => {
      const elapsed = now - startRef.current
      const pct = Math.min(100, (elapsed / durationMs) * 100)
      setProgress(pct)
      if (pct >= 100) {
        confirmedRef.current = true
        cleanup()
        onConfirm()
      } else {
        rafRef.current = requestAnimationFrame(tick)
      }
    }
    rafRef.current = requestAnimationFrame(tick)
  }

  const stop = () => {
    if (confirmedRef.current) return
    cleanup()
  }

  // Global release listener catches mouse/touch end anywhere on document
  useEffect(() => {
    if (!holding) return
    window.addEventListener('mouseup', stop)
    window.addEventListener('touchend', stop)
    window.addEventListener('touchcancel', stop)
    window.addEventListener('pointerup', stop)
    window.addEventListener('pointercancel', stop)
    return () => {
      window.removeEventListener('mouseup', stop)
      window.removeEventListener('touchend', stop)
      window.removeEventListener('touchcancel', stop)
      window.removeEventListener('pointerup', stop)
      window.removeEventListener('pointercancel', stop)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [holding])

  return (
    <button
      className={`hold-confirm ${holding ? 'holding' : ''} ${className ?? ''}`}
      onMouseDown={(e) => { e.preventDefault(); start() }}
      onTouchStart={(e) => { e.preventDefault(); start() }}
      title={hint}
    >
      <span className="hold-confirm-content">{children}</span>
      {holding && <span className="hold-confirm-fill" style={{ width: `${progress}%` }} />}
    </button>
  )
}
