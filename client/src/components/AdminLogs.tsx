import { useEffect, useState } from 'react'
import { api, type DiagnosticReport, type LogEntry, type LogLevel, type LogsPage, type LogsStats } from '../api'
import { useAuth } from '../auth'
import { Navigate } from 'react-router-dom'

const LEVELS: (LogLevel | '')[] = ['', 'Info', 'Warning', 'Error', 'Critical']
const REFRESH_MS = 5000

export default function AdminLogs() {
  const { profile } = useAuth()
  const [stats, setStats] = useState<LogsStats | null>(null)
  const [diag, setDiag] = useState<DiagnosticReport | null>(null)
  const [diagLoading, setDiagLoading] = useState(false)
  const [logs, setLogs] = useState<LogsPage | null>(null)
  const [auto, setAuto] = useState(true)
  const [loading, setLoading] = useState(false)

  // Filters
  const [level, setLevel] = useState<LogLevel | ''>('')
  const [eventType, setEventType] = useState('')
  const [endpoint, setEndpoint] = useState('')
  const [traceId, setTraceId] = useState('')
  const [minDurationMs, setMinDurationMs] = useState<number | ''>('')
  const [hours, setHours] = useState(1)
  const [page, setPage] = useState(1)
  const pageSize = 50

  const refresh = async () => {
    setLoading(true)
    try {
      const [s, p] = await Promise.all([
        api.adminLogsStats(hours),
        api.adminQueryLogs({
          level: level || undefined,
          eventType: eventType || undefined,
          endpoint: endpoint || undefined,
          traceId: traceId || undefined,
          minDurationMs: minDurationMs === '' ? undefined : Number(minDurationMs),
          since: new Date(Date.now() - hours * 3600_000).toISOString(),
          page,
          pageSize,
        }),
      ])
      setStats(s); setLogs(p)
    } finally { setLoading(false) }
  }

  useEffect(() => { refresh() }, [hours, level, eventType, endpoint, traceId, minDurationMs, page])

  const runDiagnose = async () => {
    setDiagLoading(true)
    try { setDiag(await api.adminLogsDiagnose(hours)) }
    finally { setDiagLoading(false) }
  }

  useEffect(() => { runDiagnose() }, [hours])

  useEffect(() => {
    if (!auto) return
    const t = setInterval(refresh, REFRESH_MS)
    return () => clearInterval(t)
  }, [auto, hours, level, eventType, endpoint, traceId, minDurationMs, page])

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
          <button onClick={runDiagnose} disabled={diagLoading} className="deck-btn">
            {diagLoading ? 'Analyzing...' : '↻ Re-run'}
          </button>
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
          <StatCard label="Window (h)" value={hours} />
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
          <h2 className="section-title">Event types ({hours}h)</h2>
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
        <select value={hours} onChange={e => { setHours(Number(e.target.value)); setPage(1) }}>
          <option value={1}>Last 1h</option>
          <option value={6}>Last 6h</option>
          <option value={24}>Last 24h</option>
          <option value={168}>Last 7d</option>
        </select>
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

function StatCard({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
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
