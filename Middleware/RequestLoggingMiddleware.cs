using System.Diagnostics;
using System.Security.Claims;
using Api.Models;
using Api.Services.Logging;

namespace Api.Middleware;

public class RequestLoggingMiddleware(RequestDelegate next, ConcurrencyTracker concurrency)
{
    private const long SlowRequestMs = 500;

    public async Task InvokeAsync(HttpContext context, IEventLog log)
    {
        // Skip noisy/static paths.
        var path = context.Request.Path.Value ?? "";
        if (path.StartsWith("/openapi", StringComparison.OrdinalIgnoreCase))
        {
            await next(context);
            return;
        }

        var traceId = context.TraceIdentifier;
        context.Response.Headers["X-Trace-Id"] = traceId;

        var inflight = concurrency.Increment();
        var sw = Stopwatch.StartNew();
        Exception? captured = null;

        try
        {
            await next(context);
        }
        catch (Exception ex)
        {
            captured = ex;
            throw;
        }
        finally
        {
            sw.Stop();
            concurrency.Decrement();

            var duration = sw.ElapsedMilliseconds;
            var status = context.Response?.StatusCode ?? 0;
            var userId = TryGetUserId(context);
            var endpoint = path;
            var method = context.Request.Method;

            EventLogLevel level;
            string eventType;
            if (captured is not null) { level = EventLogLevel.Error; eventType = "request.exception"; }
            else if (status >= 500) { level = EventLogLevel.Error; eventType = "request.server_error"; }
            else if (status == 401 || status == 403) { level = EventLogLevel.Warning; eventType = "request.auth_denied"; }
            else if (status >= 400) { level = EventLogLevel.Warning; eventType = "request.client_error"; }
            else if (duration >= SlowRequestMs) { level = EventLogLevel.Warning; eventType = "request.slow"; }
            else { level = EventLogLevel.Info; eventType = "request.ok"; }

            log.Write(
                level: level,
                eventType: eventType,
                message: captured?.Message,
                traceId: traceId,
                userId: userId,
                endpoint: endpoint,
                httpMethod: method,
                statusCode: status,
                durationMs: duration,
                concurrency: inflight,
                source: "RequestLogging",
                metadata: captured is null ? null : new { exception = captured.GetType().Name, stack = captured.StackTrace?.Split('\n')[0] }
            );
        }
    }

    private static Guid? TryGetUserId(HttpContext ctx)
    {
        var sub = ctx.User.FindFirst("sub")?.Value ?? ctx.User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        return Guid.TryParse(sub, out var id) ? id : null;
    }
}
