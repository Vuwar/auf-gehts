using Api.Data;
using Api.DTOs.Responses;
using Api.Models;
using Api.Services;
using Api.Services.Logging;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Api.Controllers;

[Route("api/admin/logs")]
public class AdminLogsController(AppDbContext db, CurrentUserAccessor currentUser, ConcurrencyTracker concurrency, DiagnosticAnalyzer analyzer) : BaseController
{
    private const int MaxPageSize = 200;

    [HttpGet]
    public async Task<ActionResult<object>> Query(
        [FromQuery] string? level,
        [FromQuery] string? eventType,
        [FromQuery] string? endpoint,
        [FromQuery] string? traceId,
        [FromQuery] Guid? userId,
        [FromQuery] long? minDurationMs,
        [FromQuery] DateTime? since,
        [FromQuery] DateTime? until,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50)
    {
        var current = await currentUser.GetAsync();
        if (current?.Role != UserRole.Admin) return Forbid();

        pageSize = Math.Clamp(pageSize, 1, MaxPageSize);
        page = Math.Max(1, page);

        var q = db.EventLogs.AsNoTracking().AsQueryable();

        if (!string.IsNullOrEmpty(level) && Enum.TryParse<EventLogLevel>(level, true, out var lv))
            q = q.Where(e => e.Level == lv);
        if (!string.IsNullOrEmpty(eventType)) q = q.Where(e => e.EventType == eventType);
        if (!string.IsNullOrEmpty(endpoint)) q = q.Where(e => e.Endpoint == endpoint);
        if (!string.IsNullOrEmpty(traceId)) q = q.Where(e => e.TraceId == traceId);
        if (userId.HasValue) q = q.Where(e => e.UserId == userId.Value);
        if (minDurationMs.HasValue) q = q.Where(e => e.DurationMs >= minDurationMs.Value);
        if (since.HasValue) q = q.Where(e => e.Timestamp >= since.Value);
        if (until.HasValue) q = q.Where(e => e.Timestamp <= until.Value);

        var total = await q.CountAsync();
        var items = await q.OrderByDescending(e => e.Timestamp)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        return Ok(new { total, page, pageSize, items });
    }

    [HttpGet("stats")]
    public async Task<ActionResult<object>> Stats([FromQuery] int hours = 1)
    {
        var current = await currentUser.GetAsync();
        if (current?.Role != UserRole.Admin) return Forbid();
        hours = Math.Clamp(hours, 1, 168);
        var since = DateTime.UtcNow.AddHours(-hours);

        var rows = await db.EventLogs.AsNoTracking()
            .Where(e => e.Timestamp >= since)
            .GroupBy(e => new { e.Level, e.EventType })
            .Select(g => new { g.Key.Level, g.Key.EventType, count = g.Count() })
            .ToListAsync();

        var slowEndpoints = await db.Database.SqlQueryRaw<SlowEndpointRow>(
            """
            SELECT
                "Endpoint" AS "Endpoint",
                count(*)::int AS "Count",
                COALESCE(avg("DurationMs"::double precision), 0.0) AS "AvgMs",
                COALESCE(percentile_cont(0.95) WITHIN GROUP (ORDER BY "DurationMs"::double precision), 0.0) AS "P95Ms",
                COALESCE(max("DurationMs"), 0) AS "MaxMs"
            FROM event_logs
            WHERE "Timestamp" >= {0} AND "DurationMs" IS NOT NULL AND "EventType" LIKE 'request.%'
            GROUP BY "Endpoint"
            ORDER BY "AvgMs" DESC
            LIMIT 20
            """, since).ToListAsync();

        var slowQueries = await db.EventLogs.AsNoTracking()
            .Where(e => e.Timestamp >= since && e.EventType == "db.slow_query")
            .CountAsync();

        return Ok(new
        {
            sinceUtc = since,
            concurrencyCurrent = concurrency.Current,
            concurrencyPeak = concurrency.Peak,
            byTypeAndLevel = rows,
            slowEndpoints = slowEndpoints.Select(s => new
            {
                endpoint = s.Endpoint,
                count = s.Count,
                avgMs = s.AvgMs,
                p95Ms = (long)Math.Round(s.P95Ms),
                maxMs = s.MaxMs,
            }),
            slowQueryCount = slowQueries,
        });
    }

    [HttpGet("diagnose")]
    public async Task<ActionResult<DiagnosticReport>> Diagnose([FromQuery] int hours = 1)
    {
        var current = await currentUser.GetAsync();
        if (current?.Role != UserRole.Admin) return Forbid();
        return Ok(await analyzer.RunAsync(hours));
    }

    public class SlowEndpointRow
    {
        public string? Endpoint { get; set; }
        public int Count { get; set; }
        public double AvgMs { get; set; }
        public double P95Ms { get; set; }
        public long MaxMs { get; set; }
    }
}
