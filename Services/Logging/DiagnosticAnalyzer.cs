using Api.Data;
using Api.DTOs.Responses;
using Microsoft.EntityFrameworkCore;

namespace Api.Services.Logging;

public class DiagnosticAnalyzer(IServiceScopeFactory scopeFactory, ConcurrencyTracker concurrency)
{
    public async Task<DiagnosticReport> RunAsync(int minutes)
    {
        minutes = Math.Clamp(minutes, 1, 168 * 60);
        var since = DateTime.UtcNow.AddMinutes(-minutes);

        // Fan out all 7 analyses in parallel — each gets its own DbContext + connection
        // (EF Core doesn't allow concurrent ops on a single context). Pool naturally queues
        // any beyond the configured Maximum Pool Size; wall-clock time becomes roughly
        // max(query) rather than sum(query).
        var totalsTask    = Scoped(d => ComputeTotalsAsync(d, since));
        var slowConcTask  = Scoped(d => FindSlowUnderConcurrencyAsync(d, since));
        var dbBottleTask  = Scoped(d => FindDbBottleneckAsync(d, since));
        var aiTask        = Scoped(d => FindAiDurationAsync(d, since));
        var cacheTask     = Scoped(d => FindCacheInefficiencyAsync(d, since));
        var netTask       = Scoped(d => FindNetworkOverheadAsync(d, since));
        var rateTask      = Scoped(d => FindRateLimitPressureAsync(d, since));

        await Task.WhenAll(totalsTask, slowConcTask, dbBottleTask, aiTask, cacheTask, netTask, rateTask);

        var totals = await totalsTask;
        var findings = new List<DiagnosticFinding>();
        findings.AddRange(await slowConcTask);
        findings.AddRange(await dbBottleTask);
        findings.AddRange(await aiTask);
        findings.AddRange(await cacheTask);
        findings.AddRange(await netTask);
        findings.AddRange(await rateTask);

        if (totals.Requests < 20)
        {
            findings.Insert(0, new DiagnosticFinding(
                "info", "data",
                "Limited data",
                $"Only {totals.Requests} requests in window. Findings may be noisy.",
                new Dictionary<string, object?> { ["requests"] = totals.Requests }));
        }

        findings = findings
            .OrderBy(f => SeverityRank(f.Severity))
            .ThenBy(f => f.Category)
            .ToList();

        var windowHours = Math.Max(1, (int)Math.Round(minutes / 60.0));
        return new DiagnosticReport(windowHours, since, totals, findings);
    }

    private async Task<T> Scoped<T>(Func<AppDbContext, Task<T>> work)
    {
        using var scope = scopeFactory.CreateScope();
        var d = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        return await work(d);
    }

    private async Task<DiagnosticTotals> ComputeTotalsAsync(AppDbContext db, DateTime since)
    {
        var rows = await db.Database.SqlQueryRaw<TotalsRow>(
            """
            SELECT
                count(*) FILTER (WHERE "EventType" LIKE 'request.%') AS "Requests",
                count(*) FILTER (WHERE "EventType" = 'request.slow') AS "SlowRequests",
                count(*) FILTER (WHERE "Level" >= 2 AND "EventType" LIKE 'request.%') AS "Errors",
                COALESCE(percentile_cont(0.50) WITHIN GROUP (ORDER BY "DurationMs"::double precision) FILTER (WHERE "EventType" LIKE 'request.%' AND "DurationMs" IS NOT NULL), 0.0) AS "P50Ms",
                COALESCE(percentile_cont(0.95) WITHIN GROUP (ORDER BY "DurationMs"::double precision) FILTER (WHERE "EventType" LIKE 'request.%' AND "DurationMs" IS NOT NULL), 0.0) AS "P95Ms",
                COALESCE(percentile_cont(0.99) WITHIN GROUP (ORDER BY "DurationMs"::double precision) FILTER (WHERE "EventType" LIKE 'request.%' AND "DurationMs" IS NOT NULL), 0.0) AS "P99Ms"
            FROM event_logs
            WHERE "Timestamp" >= {0}
            """, since).ToListAsync();

        var r = rows.FirstOrDefault() ?? new TotalsRow();
        return new DiagnosticTotals(r.Requests, r.SlowRequests, r.Errors, r.P50Ms, r.P95Ms, r.P99Ms, concurrency.Peak);
    }

    private async Task<List<DiagnosticFinding>> FindSlowUnderConcurrencyAsync(AppDbContext db, DateTime since)
    {
        var rows = await db.Database.SqlQueryRaw<ConcurrencySlowRow>(
            """
            SELECT
                "Endpoint" AS "Endpoint",
                AVG("DurationMs"::double precision) FILTER (WHERE "Concurrency" = 1) AS "SoloMs",
                AVG("DurationMs"::double precision) FILTER (WHERE "Concurrency" >= 2) AS "ConcurrentMs",
                count(*) FILTER (WHERE "Concurrency" = 1) AS "SoloSamples",
                count(*) FILTER (WHERE "Concurrency" >= 2) AS "ConcurrentSamples"
            FROM event_logs
            WHERE "Timestamp" >= {0} AND "EventType" LIKE 'request.%' AND "DurationMs" IS NOT NULL AND "Endpoint" IS NOT NULL
            GROUP BY "Endpoint"
            HAVING count(*) FILTER (WHERE "Concurrency" = 1) >= 3 AND count(*) FILTER (WHERE "Concurrency" >= 2) >= 3
            """, since).ToListAsync();

        var findings = new List<DiagnosticFinding>();
        foreach (var r in rows)
        {
            if (r.SoloMs <= 0 || r.ConcurrentMs <= 0) continue;
            var ratio = r.ConcurrentMs / r.SoloMs;
            if (ratio < 1.5) continue;
            var sev = ratio >= 2.5 ? "high" : ratio >= 1.8 ? "medium" : "low";
            findings.Add(new DiagnosticFinding(
                sev, "concurrency",
                $"{r.Endpoint} is {ratio:F1}× slower under concurrent load",
                $"Avg {Math.Round(r.SoloMs)}ms alone, {Math.Round(r.ConcurrentMs)}ms with 2+ inflight ({r.ConcurrentSamples} samples).",
                new Dictionary<string, object?>
                {
                    ["endpoint"] = r.Endpoint,
                    ["soloMs"] = Math.Round(r.SoloMs, 1),
                    ["concurrentMs"] = Math.Round(r.ConcurrentMs, 1),
                    ["ratio"] = Math.Round(ratio, 2),
                    ["soloSamples"] = r.SoloSamples,
                    ["concurrentSamples"] = r.ConcurrentSamples,
                }));
        }
        return findings;
    }

    private async Task<List<DiagnosticFinding>> FindDbBottleneckAsync(AppDbContext db, DateTime since)
    {
        // Two independent counts in one round-trip via a single query.
        var rows = await db.Database.SqlQueryRaw<DbBottleneckRow>(
            """
            SELECT
                count(*) FILTER (WHERE "EventType" = 'db.slow_query') AS "SlowCount",
                count(*) FILTER (WHERE "EventType" = 'db.query_failed') AS "FailCount"
            FROM event_logs
            WHERE "Timestamp" >= {0}
            """, since).ToListAsync();

        var row = rows.FirstOrDefault() ?? new DbBottleneckRow();
        var slowCount = row.SlowCount;
        var failCount = row.FailCount;

        var findings = new List<DiagnosticFinding>();
        if (slowCount >= 30)
        {
            findings.Add(new DiagnosticFinding("high", "db",
                $"{slowCount} slow DB queries (>200ms)",
                "Database likely bottleneck. Check connection pool, indexes, or Supabase region latency.",
                new Dictionary<string, object?> { ["slowQueryCount"] = slowCount, ["failedCount"] = failCount }));
        }
        else if (slowCount >= 10)
        {
            findings.Add(new DiagnosticFinding("medium", "db",
                $"{slowCount} slow DB queries (>200ms)",
                "DB latency contributing to slow requests. Review slow_query entries for repeated patterns.",
                new Dictionary<string, object?> { ["slowQueryCount"] = slowCount, ["failedCount"] = failCount }));
        }
        if (failCount > 0)
        {
            findings.Add(new DiagnosticFinding("high", "db",
                $"{failCount} DB query failures",
                "Queries throwing exceptions. Check db.query_failed events.",
                new Dictionary<string, object?> { ["failedCount"] = failCount }));
        }
        return findings;
    }

    private async Task<List<DiagnosticFinding>> FindAiDurationAsync(AppDbContext db, DateTime since)
    {
        var rows = await db.Database.SqlQueryRaw<AiStatsRow>(
            """
            SELECT
                count(*) AS "Count",
                count(*) FILTER (WHERE "Level" = 2) AS "ErrorCount",
                COALESCE(percentile_cont(0.95) WITHIN GROUP (ORDER BY "DurationMs"::double precision) FILTER (WHERE "DurationMs" IS NOT NULL), 0.0) AS "P95Ms",
                COALESCE(max("DurationMs"), 0) AS "MaxMs"
            FROM event_logs
            WHERE "Timestamp" >= {0} AND "EventType" LIKE 'ai.%'
            """, since).ToListAsync();

        var findings = new List<DiagnosticFinding>();
        var r = rows.FirstOrDefault();
        if (r is null || r.Count == 0) return findings;

        if (r.ErrorCount > 0)
        {
            var sev = r.ErrorCount >= 5 ? "high" : "medium";
            findings.Add(new DiagnosticFinding(sev, "ai",
                $"{r.ErrorCount} AI call failures",
                "Groq returning errors or exceptions raised. Check ai.upstream_error events.",
                new Dictionary<string, object?> { ["errorCount"] = r.ErrorCount, ["totalCalls"] = r.Count }));
        }
        if (r.P95Ms >= 8000)
        {
            findings.Add(new DiagnosticFinding("medium", "ai",
                $"AI p95 = {Math.Round(r.P95Ms)}ms",
                "AI generation slow. Inherent to upstream Groq. Consider streaming or smaller model for translate.",
                new Dictionary<string, object?> { ["p95Ms"] = Math.Round(r.P95Ms, 1), ["maxMs"] = r.MaxMs, ["totalCalls"] = r.Count }));
        }
        return findings;
    }

    private async Task<List<DiagnosticFinding>> FindCacheInefficiencyAsync(AppDbContext db, DateTime since)
    {
        var rows = await db.EventLogs.AsNoTracking()
            .Where(e => e.Timestamp >= since && (e.EventType == "cache.hit" || e.EventType == "cache.miss"))
            .GroupBy(e => new { e.Message, e.EventType })
            .Select(g => new { g.Key.Message, g.Key.EventType, Count = g.Count() })
            .ToListAsync();

        var byNs = rows.GroupBy(r => r.Message ?? "(none)")
            .Select(g => new
            {
                Namespace = g.Key,
                Hits = g.Where(x => x.EventType == "cache.hit").Sum(x => x.Count),
                Misses = g.Where(x => x.EventType == "cache.miss").Sum(x => x.Count),
            })
            .ToList();

        var findings = new List<DiagnosticFinding>();
        foreach (var ns in byNs)
        {
            var total = ns.Hits + ns.Misses;
            if (total < 10) continue;
            var ratio = ns.Hits / (double)total;
            if (ratio >= 0.5) continue;
            var sev = ratio < 0.2 ? "high" : "medium";
            findings.Add(new DiagnosticFinding(sev, "cache",
                $"{ns.Namespace} hit ratio = {ratio:P0}",
                $"{ns.Hits} hits / {ns.Misses} misses. Consider longer TTL, warm-up, or check key uniqueness.",
                new Dictionary<string, object?>
                {
                    ["namespace"] = ns.Namespace,
                    ["hits"] = ns.Hits,
                    ["misses"] = ns.Misses,
                    ["hitRatio"] = Math.Round(ratio, 3),
                }));
        }
        return findings;
    }

    private async Task<List<DiagnosticFinding>> FindNetworkOverheadAsync(AppDbContext db, DateTime since)
    {
        var rows = await db.Database.SqlQueryRaw<NetworkOverheadRow>(
            """
            WITH server AS (
                SELECT "TraceId", MAX("DurationMs") AS ms
                FROM event_logs
                WHERE "Timestamp" >= {0} AND "EventType" LIKE 'request.%' AND "TraceId" IS NOT NULL AND "DurationMs" IS NOT NULL
                GROUP BY "TraceId"
            ),
            client AS (
                SELECT "TraceId", MAX("DurationMs") AS ms
                FROM event_logs
                WHERE "Timestamp" >= {0} AND "EventType" LIKE 'client.%' AND "TraceId" IS NOT NULL AND "DurationMs" IS NOT NULL
                GROUP BY "TraceId"
            )
            SELECT
                COALESCE(percentile_cont(0.50) WITHIN GROUP (ORDER BY GREATEST(c.ms - s.ms, 0)::double precision), 0.0) AS "MedianOverheadMs",
                COALESCE(percentile_cont(0.95) WITHIN GROUP (ORDER BY GREATEST(c.ms - s.ms, 0)::double precision), 0.0) AS "P95OverheadMs",
                count(*) AS "Pairs"
            FROM client c JOIN server s ON c."TraceId" = s."TraceId"
            """, since).ToListAsync();

        var findings = new List<DiagnosticFinding>();
        var r = rows.FirstOrDefault();
        if (r is null || r.Pairs < 5) return findings;
        if (r.MedianOverheadMs < 300) return findings;
        var sev = r.MedianOverheadMs >= 800 ? "high" : "medium";
        findings.Add(new DiagnosticFinding(sev, "network",
            $"Network overhead median = {Math.Round(r.MedianOverheadMs)}ms",
            $"Client-perceived time exceeds server time by {Math.Round(r.MedianOverheadMs)}ms (p95 {Math.Round(r.P95OverheadMs)}ms) across {r.Pairs} traces. Network, cold start, or Railway region latency suspected.",
            new Dictionary<string, object?>
            {
                ["medianOverheadMs"] = Math.Round(r.MedianOverheadMs, 1),
                ["p95OverheadMs"] = Math.Round(r.P95OverheadMs, 1),
                ["pairs"] = r.Pairs,
            }));
        return findings;
    }

    private async Task<List<DiagnosticFinding>> FindRateLimitPressureAsync(AppDbContext db, DateTime since)
    {
        var count = await db.EventLogs.AsNoTracking()
            .Where(e => e.Timestamp >= since && e.EventType == "ratelimit.exceeded")
            .CountAsync();
        if (count == 0) return new();
        var sev = count >= 20 ? "high" : count >= 5 ? "medium" : "low";
        return new List<DiagnosticFinding>
        {
            new(sev, "ratelimit",
                $"{count} rate-limit rejections",
                "Users hitting limits. Reduce request volume or raise PermitLimit in Program.cs.",
                new Dictionary<string, object?> { ["count"] = count })
        };
    }

    private static int SeverityRank(string s) => s switch
    {
        "high" => 0,
        "medium" => 1,
        "low" => 2,
        _ => 3,
    };

    public class TotalsRow
    {
        public long Requests { get; set; }
        public long SlowRequests { get; set; }
        public long Errors { get; set; }
        public double P50Ms { get; set; }
        public double P95Ms { get; set; }
        public double P99Ms { get; set; }
    }
    public class ConcurrencySlowRow
    {
        public string? Endpoint { get; set; }
        public double SoloMs { get; set; }
        public double ConcurrentMs { get; set; }
        public long SoloSamples { get; set; }
        public long ConcurrentSamples { get; set; }
    }
    public class DbBottleneckRow
    {
        public long SlowCount { get; set; }
        public long FailCount { get; set; }
    }
    public class AiStatsRow
    {
        public long Count { get; set; }
        public long ErrorCount { get; set; }
        public double P95Ms { get; set; }
        public long MaxMs { get; set; }
    }
    public class NetworkOverheadRow
    {
        public double MedianOverheadMs { get; set; }
        public double P95OverheadMs { get; set; }
        public long Pairs { get; set; }
    }
}
