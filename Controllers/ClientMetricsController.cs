using Api.Models;
using Api.Services.Logging;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Api.Controllers;

[Route("api/client-metrics")]
public class ClientMetricsController(IEventLog events) : BaseController
{
    [AllowAnonymous]
    [HttpPost]
    public IActionResult Submit([FromBody] ClientMetricsBatch batch)
    {
        if (batch.Samples is null || batch.Samples.Count == 0) return NoContent();
        var userId = GetUserId();

        foreach (var s in batch.Samples.Take(100))
        {
            var level = s.DurationMs >= 1500 ? EventLogLevel.Warning : EventLogLevel.Info;
            events.Write(
                level: level,
                eventType: s.DurationMs >= 1500 ? "client.slow" : "client.latency",
                message: null,
                traceId: s.TraceId,
                userId: userId,
                endpoint: SanitizePath(s.Url),
                httpMethod: s.Method,
                statusCode: s.Status,
                durationMs: s.DurationMs,
                source: "Client",
                metadata: new
                {
                    s.Started,
                    bundleVersion = batch.BundleVersion,
                    s.Network,
                });
        }
        return NoContent();
    }

    private static string SanitizePath(string? url)
    {
        if (string.IsNullOrEmpty(url)) return "";
        var qIdx = url.IndexOf('?');
        return qIdx >= 0 ? url[..qIdx] : url;
    }

    public record ClientMetricsBatch(string? BundleVersion, List<ClientMetricSample> Samples);
    public record ClientMetricSample(
        string? TraceId,
        string? Url,
        string? Method,
        int? Status,
        long DurationMs,
        string? Started,
        string? Network
    );
}
