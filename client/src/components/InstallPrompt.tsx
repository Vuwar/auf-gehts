import { useEffect, useState } from 'react'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DISMISS_KEY = 'pwa-install-dismissed-at'
const DISMISS_TTL_MS = 1000 * 60 * 60 * 24 * 7 // 7 days

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  if (window.matchMedia?.('(display-mode: standalone)').matches) return true
  // iOS Safari
  return (window.navigator as unknown as { standalone?: boolean }).standalone === true
}

function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  const iPad = /iPad/.test(ua) || (navigator.platform === 'MacIntel' && (navigator as unknown as { maxTouchPoints?: number }).maxTouchPoints! > 1)
  return /iPhone|iPod/.test(ua) || iPad
}

function isSafari(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  return /Safari/.test(ua) && !/Chrome|CriOS|FxiOS|EdgiOS/.test(ua)
}

function isRecentlyDismissed(): boolean {
  try {
    const v = localStorage.getItem(DISMISS_KEY)
    if (!v) return false
    const at = Number(v)
    if (!Number.isFinite(at)) return false
    return Date.now() - at < DISMISS_TTL_MS
  } catch {
    return false
  }
}

export default function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [visible, setVisible] = useState(false)
  const [showIOSHint, setShowIOSHint] = useState(false)

  useEffect(() => {
    if (isStandalone()) return
    if (isRecentlyDismissed()) return

    const handler = (e: Event) => {
      e.preventDefault()
      setDeferred(e as BeforeInstallPromptEvent)
      setVisible(true)
    }
    window.addEventListener('beforeinstallprompt', handler)

    const installedHandler = () => {
      setVisible(false)
      setDeferred(null)
    }
    window.addEventListener('appinstalled', installedHandler)

    // iOS Safari has no beforeinstallprompt; show manual hint.
    if (isIOS() && isSafari()) {
      setVisible(true)
      setShowIOSHint(true)
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handler)
      window.removeEventListener('appinstalled', installedHandler)
    }
  }, [])

  if (!visible) return null

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()))
    } catch {
      // ignore
    }
    setVisible(false)
  }

  const install = async () => {
    if (!deferred) return
    try {
      await deferred.prompt()
      const choice = await deferred.userChoice
      if (choice.outcome === 'accepted') {
        setVisible(false)
      } else {
        dismiss()
      }
    } catch {
      dismiss()
    } finally {
      setDeferred(null)
    }
  }

  return (
    <div className="install-prompt" role="dialog" aria-label="Install app">
      <div className="install-prompt-body">
        <div className="install-prompt-icon" aria-hidden>📲</div>
        <div className="install-prompt-text">
          <div className="install-prompt-title">Install auf gehts</div>
          {showIOSHint ? (
            <div className="install-prompt-desc">
              Tap <span className="install-prompt-kbd">Share</span> then <span className="install-prompt-kbd">Add to Home Screen</span>.
            </div>
          ) : (
            <div className="install-prompt-desc">Works offline. Quick launch from home screen.</div>
          )}
        </div>
      </div>
      <div className="install-prompt-actions">
        {!showIOSHint && deferred && (
          <button type="button" className="install-prompt-btn primary" onClick={install}>
            Install
          </button>
        )}
        <button type="button" className="install-prompt-btn" onClick={dismiss} aria-label="Dismiss">
          {showIOSHint ? 'Got it' : 'Not now'}
        </button>
      </div>
    </div>
  )
}
