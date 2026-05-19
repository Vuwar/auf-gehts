using System.Diagnostics;
using System.Reflection;
using System.Runtime.InteropServices;
using Api.Data;
using Api.DTOs.Responses;
using Api.Models;
using Api.Services;
using Api.Services.Logging;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;

namespace Api.Controllers;

[Route("api/admin/logs")]
public class AdminLogsController(AppDbContext db, CurrentUserAccessor currentUser, ConcurrencyTracker concurrency, DiagnosticAnalyzer analyzer, IMemoryCache cache) : BaseController
{
    private const int MaxPageSize = 200;
    private static readonly TimeSpan DiagnoseTtl = TimeSpan.FromSeconds(10);

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
    public async Task<ActionResult<object>> Stats([FromQuery] int hours = 1, [FromQuery] int? minutes = null)
    {
        var current = await currentUser.GetAsync();
        if (current?.Role != UserRole.Admin) return Forbid();
        // `minutes` takes precedence when supplied so callers can pick arbitrary windows
        // (e.g. 5min, 43min); `hours` is kept for backward compatibility.
        var windowMinutes = Math.Clamp(minutes ?? hours * 60, 1, 168 * 60);
        var since = DateTime.UtcNow.AddMinutes(-windowMinutes);

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
    public async Task<ActionResult<DiagnosticReport>> Diagnose([FromQuery] int hours = 1, [FromQuery] int? minutes = null)
    {
        var current = await currentUser.GetAsync();
        if (current?.Role != UserRole.Admin) return Forbid();
        var windowMinutes = Math.Clamp(minutes ?? hours * 60, 1, 168 * 60);

        // 10s in-memory cache coalesces the admin page's auto-refresh + multiple admin tabs
        // into a single underlying compute. GetOrCreateAsync's Lazy semantics also serialize
        // concurrent misses for the same key, so we never run the 7-query analysis twice
        // simultaneously for the same window.
        var key = $"diagnose:{windowMinutes}";
        var report = await cache.GetOrCreateAsync(key, async entry =>
        {
            entry.AbsoluteExpirationRelativeToNow = DiagnoseTtl;
            return await analyzer.RunAsync(windowMinutes);
        });
        return Ok(report);
    }

    [HttpGet("snapshot")]
    public async Task<ActionResult<object>> Snapshot(
        [FromQuery] int minutes = 60,
        [FromQuery] int recentLogs = 200,
        [FromQuery] int recentErrors = 50)
    {
        var current = await currentUser.GetAsync();
        if (current?.Role != UserRole.Admin) return Forbid();

        var windowMinutes = Math.Clamp(minutes, 1, 168 * 60);
        recentLogs = Math.Clamp(recentLogs, 0, 1000);
        recentErrors = Math.Clamp(recentErrors, 0, 500);
        var since = DateTime.UtcNow.AddMinutes(-windowMinutes);

        var proc = Process.GetCurrentProcess();
        var startedAt = proc.StartTime.ToUniversalTime();
        var asm = Assembly.GetEntryAssembly();
        var version = asm?.GetName().Version?.ToString()
            ?? asm?.GetCustomAttribute<AssemblyInformationalVersionAttribute>()?.InformationalVersion;

        bool canConnect;
        try { canConnect = await db.Database.CanConnectAsync(); }
        catch { canConnect = false; }

        var applied = (await db.Database.GetAppliedMigrationsAsync()).ToList();
        var pending = (await db.Database.GetPendingMigrationsAsync()).ToList();

        // Sequential queries on the shared scoped DbContext (EF Core forbids concurrent ops on a single context).
        var rowCounts = new
        {
            users = await db.Users.AsNoTracking().CountAsync(),
            weeks = await db.Weeks.AsNoTracking().CountAsync(),
            wordSets = await db.WordSets.AsNoTracking().CountAsync(),
            words = await db.Words.AsNoTracking().CountAsync(),
            userSetProgress = await db.UserSetProgress.AsNoTracking().CountAsync(),
            readingTexts = await db.ReadingTexts.AsNoTracking().CountAsync(),
            wordCache = await db.WordCache.AsNoTracking().CountAsync(),
            aiUsage = await db.AiUsage.AsNoTracking().CountAsync(),
            eventLogs = await db.EventLogs.AsNoTracking().CountAsync(),
        };

        var levelCounts = await db.EventLogs.AsNoTracking()
            .Where(e => e.Timestamp >= since)
            .GroupBy(e => e.Level)
            .Select(g => new { level = g.Key.ToString(), count = g.Count() })
            .ToListAsync();

        var eventTypeCounts = await db.EventLogs.AsNoTracking()
            .Where(e => e.Timestamp >= since)
            .GroupBy(e => new { e.EventType, e.Level })
            .Select(g => new { eventType = g.Key.EventType, level = g.Key.Level.ToString(), count = g.Count() })
            .OrderByDescending(x => x.count)
            .Take(50)
            .ToListAsync();

        var slowEndpointRows = await db.Database.SqlQueryRaw<SlowEndpointRow>(
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

        var recentErrorList = recentErrors == 0
            ? new List<Api.Models.EventLog>()
            : await db.EventLogs.AsNoTracking()
                .Where(e => e.Timestamp >= since && (e.Level == EventLogLevel.Error || e.Level == EventLogLevel.Critical))
                .OrderByDescending(e => e.Timestamp)
                .Take(recentErrors)
                .ToListAsync();

        var recentLogList = recentLogs == 0
            ? new List<Api.Models.EventLog>()
            : await db.EventLogs.AsNoTracking()
                .OrderByDescending(e => e.Timestamp)
                .Take(recentLogs)
                .ToListAsync();

        DiagnosticReport? diagnostic = null;
        try { diagnostic = await analyzer.RunAsync(windowMinutes); }
        catch { /* analyzer failure shouldn't break the snapshot */ }

        var snapshot = new
        {
            generatedAtUtc = DateTime.UtcNow,
            windowMinutes,
            app = new
            {
                environment = Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT"),
                version,
                assembly = asm?.GetName().Name,
                startedAtUtc = startedAt,
                uptimeSeconds = (DateTime.UtcNow - startedAt).TotalSeconds,
                machineName = Environment.MachineName,
                osDescription = RuntimeInformation.OSDescription,
                osArchitecture = RuntimeInformation.OSArchitecture.ToString(),
                processArchitecture = RuntimeInformation.ProcessArchitecture.ToString(),
                frameworkDescription = RuntimeInformation.FrameworkDescription,
                processorCount = Environment.ProcessorCount,
                processId = proc.Id,
            },
            process = new
            {
                workingSetBytes = proc.WorkingSet64,
                privateMemoryBytes = proc.PrivateMemorySize64,
                gcTotalMemoryBytes = GC.GetTotalMemory(forceFullCollection: false),
                gcGen0Collections = GC.CollectionCount(0),
                gcGen1Collections = GC.CollectionCount(1),
                gcGen2Collections = GC.CollectionCount(2),
                threadCount = proc.Threads.Count,
                handleCount = proc.HandleCount,
                totalProcessorTimeSec = proc.TotalProcessorTime.TotalSeconds,
            },
            db = new
            {
                provider = db.Database.ProviderName,
                canConnect,
                appliedMigrationsCount = applied.Count,
                pendingMigrationsCount = pending.Count,
                latestMigration = applied.LastOrDefault(),
                pendingMigrations = pending,
                rowCounts,
            },
            concurrency = new
            {
                current = concurrency.Current,
                peak = concurrency.Peak,
            },
            logs = new
            {
                sinceUtc = since,
                byLevel = levelCounts,
                topEventTypes = eventTypeCounts,
                slowEndpoints = slowEndpointRows.Select(s => new
                {
                    endpoint = s.Endpoint,
                    count = s.Count,
                    avgMs = s.AvgMs,
                    p95Ms = (long)Math.Round(s.P95Ms),
                    maxMs = s.MaxMs,
                }),
                recentErrors = recentErrorList,
                recent = recentLogList,
            },
            diagnostic,
        };

        var filename = $"diagnostics-{DateTime.UtcNow:yyyyMMdd-HHmmss}.json";
        Response.Headers["Content-Disposition"] = $"attachment; filename=\"{filename}\"";
        return Ok(snapshot);
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
