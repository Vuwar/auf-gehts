import { useEffect, useState } from 'react'
import { api, type DiagnosticReport, type LogEntry, type LogLevel, type LogsPage, type LogsStats } from '../api'
import { useAuth } from '../auth'
import { Navigate } from 'react-router-dom'

const LEVELS: (LogLevel | '')[] = ['', 'Info', 'Warning', 'Error', 'Critical']
// 15s (was 5s). Each refresh fires 2 expensive aggregate queries on event_logs; a
// 5s cadence + 5-15s query latency caused refreshes to pile up on the connection pool
// and starve the rest of the app.
const REFRESH_MS = 15000

export default function AdminLogs() {
  const { profile } = useAuth()
  const [stats, setStats] = useState<LogsStats | null>(null)
  const [diag, setDiag] = useState<DiagnosticReport | null>(null)
  const [diagLoading, setDiagLoading] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [logs, setLogs] = useState<LogsPage | null>(null)
  const [auto, setAuto] = useState(true)
  const [loading, setLoading] = useState(false)

  // Filters
  const [level, setLevel] = useState<LogLevel | ''>('')
  const [eventType, setEventType] = useState('')
  const [endpoint, setEndpoint] = useState('')
  const [traceId, setTraceId] = useState('')
  const [minDurationMs, setMinDurationMs] = useState<number | ''>('')
  const [windowMinutes, setWindowMinutes] = useState(60)
  const [windowInput, setWindowInput] = useState('60m')
  const [page, setPage] = useState(1)
  const pageSize = 50

  const refresh = async () => {
    setLoading(true)
    try {
      const [s, p] = await Promise.all([
        api.adminLogsStats(windowMinutes),
        api.adminQueryLogs({
          level: level || undefined,
          eventType: eventType || undefined,
          endpoint: endpoint || undefined,
          traceId: traceId || undefined,
          minDurationMs: minDurationMs === '' ? undefined : Number(minDurationMs),
          since: new Date(Date.now() - windowMinutes * 60_000).toISOString(),
          page,
          pageSize,
        }),
      ])
      setStats(s); setLogs(p)
    } finally { setLoading(false) }
  }

  useEffect(() => { refresh() }, [windowMinutes, level, eventType, endpoint, traceId, minDurationMs, page])

  const runDiagnose = async () => {
    setDiagLoading(true)
    try { setDiag(await api.adminLogsDiagnose(windowMinutes)) }
    finally { setDiagLoading(false) }
  }

  const downloadDiagnostics = async () => {
    setDownloading(true)
    try { await api.adminDownloadDiagnostics(windowMinutes) }
    catch (e) { alert(`Download failed: ${e instanceof Error ? e.message : String(e)}`) }
    finally { setDownloading(false) }
  }

  useEffect(() => { runDiagnose() }, [windowMinutes])

  useEffect(() => {
    if (!auto) return
    // Pause polling when the tab is hidden. Without this, a backgrounded admin tab
    // keeps firing 2-3 heavy aggregate queries every interval, holding pool connections
    // that the foreground app needs.
    const t = setInterval(() => { if (!document.hidden) refresh() }, REFRESH_MS)
    return () => clearInterval(t)
  }, [auto, windowMinutes, level, eventType, endpoint, traceId, minDurationMs, page])

  const applyWindowInput = () => {
    const parsed = parseDurationToMinutes(windowInput)
    if (parsed === null) return
    const clamped = Math.max(1, Math.min(168 * 60, parsed))
    setWindowMinutes(clamped)
    setWindowInput(formatMinutes(clamped))
    setPage(1)
  }

  const presets: { label: string; minutes: number }[] = [
    { label: '5m', minutes: 5 },
    { label: '15m', minutes: 15 },
    { label: '30m', minutes: 30 },
    { label: '1h', minutes: 60 },
    { label: '6h', minutes: 360 },
    { label: '24h', minutes: 1440 },
    { label: '7d', minutes: 10080 },
  ]

  if (profile && profile.role !== 'Admin') return <Navigate to="/dashboard" replace />

  return (
    <div className="deck">
      <div className="deck-header">
        <div>
          <h1>Logs & metrics</h1>
          <span className="deck-progress">Live system observability</span>
        </div>
        <label style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <input type="checkbox" checked={auto} onChange={e => setAuto(e.target.checked)} />
          <span>Auto-refresh</span>
        </label>
      </div>

      <div className="diag-section">
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '8px' }}>
          <h2 className="section-title" style={{ margin: 0 }}>Diagnostic report</h2>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button onClick={downloadDiagnostics} disabled={downloading} className="deck-btn" title="Download full diagnostics snapshot as JSON">
              {downloading ? 'Preparing...' : '⬇ Download JSON'}
            </button>
            <button onClick={runDiagnose} disabled={diagLoading} className="deck-btn">
              {diagLoading ? 'Analyzing...' : '↻ Re-run'}
            </button>
          </div>
        </div>
        {diag && diag.totals && (
          <p className="hint" style={{ marginTop: '4px' }}>
            {diag.totals.requests} requests · p50 {Math.round(diag.totals.p50Ms)}ms · p95 {Math.round(diag.totals.p95Ms)}ms · p99 {Math.round(diag.totals.p99Ms)}ms · {diag.totals.errors} errors · {diag.totals.slowRequests} slow
          </p>
        )}
        {diag && diag.findings.length === 0 && (
          <p className="empty-state">No issues detected. Either healthy, or insufficient data in window.</p>
        )}
        {diag && diag.findings.map((f, i) => (
          <div key={i} className={`diag-card sev-${f.severity}`}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '8px' }}>
              <div>
                <span className={`diag-sev-badge sev-${f.severity}`}>{f.severity}</span>
                <span className="diag-category">{f.category}</span>
              </div>
            </div>
            <strong>{f.title}</strong>
            <p>{f.summary}</p>
            {Object.keys(f.evidence).length > 0 && (
              <details>
                <summary>Evidence</summary>
                <pre className="log-meta">{JSON.stringify(f.evidence, null, 2)}</pre>
              </details>
            )}
          </div>
        ))}
      </div>

      {stats && (
        <div className="logs-stats-grid">
          <StatCard label="Inflight" value={stats.concurrencyCurrent} accent />
          <StatCard label="Peak" value={stats.concurrencyPeak} />
          <StatCard label="Slow queries" value={stats.slowQueryCount} />
          <StatCard label="Window" value={formatMinutes(windowMinutes)} />
        </div>
      )}

      {stats && stats.slowEndpoints.length > 0 && (
        <>
          <h2 className="section-title">Slowest endpoints</h2>
          <div className="logs-table-wrap">
            <table className="logs-table">
              <thead>
                <tr><th>Endpoint</th><th>Count</th><th>Avg ms</th><th>p95 ms</th><th>Max ms</th></tr>
              </thead>
              <tbody>
                {stats.slowEndpoints.map(s => (
                  <tr key={s.endpoint ?? 'null'}>
                    <td>{s.endpoint ?? '—'}</td>
                    <td>{s.count}</td>
                    <td>{Math.round(s.avgMs)}</td>
                    <td>{s.p95Ms}</td>
                    <td>{s.maxMs}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {stats && stats.byTypeAndLevel.length > 0 && (
        <>
          <h2 className="section-title">Event types ({formatMinutes(windowMinutes)})</h2>
          <div className="logs-chip-row">
            {stats.byTypeAndLevel.map(b => (
              <button
                key={`${b.eventType}-${b.level}`}
                className={`logs-chip level-${b.level.toLowerCase()}`}
                onClick={() => { setEventType(b.eventType); setLevel(b.level); setPage(1) }}
              >
                <span>{b.eventType}</span>
                <strong>{b.count}</strong>
              </button>
            ))}
          </div>
        </>
      )}

      <h2 className="section-title">Filter logs</h2>
      <div className="form-row logs-filters">
        <select value={level} onChange={e => { setLevel(e.target.value as LogLevel | ''); setPage(1) }}>
          {LEVELS.map(l => <option key={l} value={l}>{l || 'All levels'}</option>)}
        </select>
        <input type="text" placeholder="Event type (e.g. request.slow)" value={eventType} onChange={e => { setEventType(e.target.value); setPage(1) }} />
        <input type="text" placeholder="Endpoint" value={endpoint} onChange={e => { setEndpoint(e.target.value); setPage(1) }} />
        <input type="text" placeholder="Trace id" value={traceId} onChange={e => { setTraceId(e.target.value); setPage(1) }} />
        <input type="number" placeholder="Min ms" value={minDurationMs} onChange={e => { setMinDurationMs(e.target.value === '' ? '' : Number(e.target.value)); setPage(1) }} />
        <div className="logs-window-picker">
          <span className="hint">Window</span>
          {presets.map(p => (
            <button
              key={p.minutes}
              type="button"
              onClick={() => { setWindowMinutes(p.minutes); setWindowInput(p.label); setPage(1) }}
              className={`tab-toggle-btn ${windowMinutes === p.minutes ? 'active' : ''}`}
            >
              {p.label}
            </button>
          ))}
          <input
            type="text"
            value={windowInput}
            onChange={e => setWindowInput(e.target.value)}
            onBlur={applyWindowInput}
            onKeyDown={e => { if (e.key === 'Enter') { (e.target as HTMLInputElement).blur() } }}
            placeholder="e.g. 43m, 2h, 90s"
            aria-label="Custom window (e.g. 43m, 2h, 1d, 90s)"
            style={{ width: '110px' }}
          />
        </div>
        <button onClick={refresh} disabled={loading} className="deck-btn">{loading ? '...' : '↻'}</button>
      </div>

      {logs && (
        <>
          <div className="logs-table-wrap">
            <table className="logs-table">
              <thead>
                <tr>
                  <th>Time</th><th>Lvl</th><th>Type</th><th>Endpoint</th>
                  <th>ms</th><th>Status</th><th>Conc</th><th>Trace</th>
                </tr>
              </thead>
              <tbody>
                {logs.items.length === 0 && (
                  <tr><td colSpan={8} className="empty-state">No logs.</td></tr>
                )}
                {logs.items.map(r => <LogRow key={r.id} entry={r} />)}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', justifyContent: 'space-between' }}>
            <p className="hint">{logs.total} total · page {logs.page}</p>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="deck-btn">← Prev</button>
              <button disabled={page * pageSize >= logs.total} onClick={() => setPage(page + 1)} className="deck-btn">Next →</button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function StatCard({ label, value, accent }: { label: string; value: number | string; accent?: boolean }) {
  return (
    <div className={`logs-stat-card ${accent ? 'accent' : ''}`}>
      <span className="card-label">{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function LogRow({ entry }: { entry: LogEntry }) {
  const [expanded, setExpanded] = useState(false)
  const time = new Date(entry.timestamp).toLocaleTimeString()
  return (
    <>
      <tr className={`log-row level-${entry.level.toLowerCase()}`} onClick={() => setExpanded(!expanded)}>
        <td>{time}</td>
        <td><span className={`log-level-badge level-${entry.level.toLowerCase()}`}>{entry.level[0]}</span></td>
        <td className="mono">{entry.eventType}</td>
        <td className="mono">{entry.httpMethod ? `${entry.httpMethod} ` : ''}{entry.endpoint ?? '—'}</td>
        <td>{entry.durationMs ?? ''}</td>
        <td>{entry.statusCode ?? ''}</td>
        <td>{entry.concurrency ?? ''}</td>
        <td className="mono" style={{ fontSize: '11px' }}>{entry.traceId ? entry.traceId.slice(-8) : ''}</td>
      </tr>
      {expanded && (
        <tr className="log-row-detail">
          <td colSpan={8}>
            {entry.message && <p><strong>Message:</strong> {entry.message}</p>}
            {entry.userId && <p><strong>User:</strong> <span className="mono">{entry.userId}</span></p>}
            {entry.source && <p><strong>Source:</strong> {entry.source}</p>}
            {entry.metadataJson && (
              <pre className="log-meta">{tryPretty(entry.metadataJson)}</pre>
            )}
          </td>
        </tr>
      )}
    </>
  )
}

function tryPretty(s: string): string {
  try { return JSON.stringify(JSON.parse(s), null, 2) } catch { return s }
}

// Parse a duration string like "5m", "43m", "2h", "1d", "90s", or a bare number (minutes).
// Returns minutes (rounded up to 1) or null when unparseable.
function parseDurationToMinutes(input: string): number | null {
  const s = input.trim().toLowerCase()
  if (!s) return null
  const m = s.match(/^(\d+(?:\.\d+)?)\s*(s|sec|secs|m|min|mins|h|hr|hrs|d|day|days)?$/)
  if (!m) return null
  const n = Number(m[1])
  if (!isFinite(n) || n < 0) return null
  const unit = m[2] ?? 'm'
  let minutes: number
  if (unit.startsWith('s')) minutes = n / 60
  else if (unit.startsWith('h')) minutes = n * 60
  else if (unit.startsWith('d')) minutes = n * 60 * 24
  else minutes = n // m / min / mins / default
  return Math.max(1, Math.round(minutes))
}

function formatMinutes(mins: number): string {
  if (mins < 60) return `${mins}m`
  if (mins % 1440 === 0) return `${mins / 1440}d`
  if (mins % 60 === 0) return `${mins / 60}h`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return `${h}h ${m}m`
}
