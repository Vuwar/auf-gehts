using System.Text.Json;
using System.Threading.Channels;
using Api.Models;

namespace Api.Services.Logging;

public class EventLogService : IEventLog
{
    private readonly ChannelWriter<EventLog> _writer;
    private readonly ILogger<EventLogService> _log;

    public EventLogService(Channel<EventLog> channel, ILogger<EventLogService> log)
    {
        _writer = channel.Writer;
        _log = log;
    }

    public void Write(EventLogLevel level, string eventType, string? message = null,
        string? traceId = null, Guid? userId = null, string? endpoint = null,
        string? httpMethod = null, int? statusCode = null, long? durationMs = null,
        int? concurrency = null, string? source = null, object? metadata = null)
    {
        var entry = new EventLog
        {
            Timestamp = DateTime.UtcNow,
            Level = level,
            EventType = eventType,
            Message = message,
            TraceId = traceId,
            UserId = userId,
            Endpoint = endpoint,
            HttpMethod = httpMethod,
            StatusCode = statusCode,
            DurationMs = durationMs,
            Concurrency = concurrency,
            Source = source,
            MetadataJson = metadata is null ? null : SafeSerialize(metadata),
        };

        if (!_writer.TryWrite(entry))
        {
            // Channel full — drop event, log warning to stderr.
            _log.LogWarning("EventLog channel full, dropping {EventType}", eventType);
        }
    }

    public void Info(string eventType, string? message = null, object? metadata = null, string? traceId = null)
        => Write(EventLogLevel.Info, eventType, message, traceId, metadata: metadata);

    public void Warn(string eventType, string? message = null, object? metadata = null, string? traceId = null)
        => Write(EventLogLevel.Warning, eventType, message, traceId, metadata: metadata);

    public void Error(string eventType, string? message = null, object? metadata = null, string? traceId = null)
        => Write(EventLogLevel.Error, eventType, message, traceId, metadata: metadata);

    public void Critical(string eventType, string? message = null, object? metadata = null, string? traceId = null)
        => Write(EventLogLevel.Critical, eventType, message, traceId, metadata: metadata);

    private static string? SafeSerialize(object meta)
    {
        try { return JsonSerializer.Serialize(meta); }
        catch { return null; }
    }
}
