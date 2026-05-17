using Api.Models;

namespace Api.Services.Logging;

public interface IEventLog
{
    void Write(EventLogLevel level, string eventType, string? message = null,
        string? traceId = null, Guid? userId = null, string? endpoint = null,
        string? httpMethod = null, int? statusCode = null, long? durationMs = null,
        int? concurrency = null, string? source = null, object? metadata = null);

    void Info(string eventType, string? message = null, object? metadata = null, string? traceId = null);
    void Warn(string eventType, string? message = null, object? metadata = null, string? traceId = null);
    void Error(string eventType, string? message = null, object? metadata = null, string? traceId = null);
    void Critical(string eventType, string? message = null, object? metadata = null, string? traceId = null);
}
