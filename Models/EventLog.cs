namespace Api.Models;

public enum EventLogLevel
{
    Info = 0,
    Warning = 1,
    Error = 2,
    Critical = 3,
}

public class EventLog
{
    public long Id { get; set; }
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;
    public EventLogLevel Level { get; set; }
    public string EventType { get; set; } = string.Empty;
    public string? Message { get; set; }
    public string? TraceId { get; set; }
    public Guid? UserId { get; set; }
    public string? Endpoint { get; set; }
    public string? HttpMethod { get; set; }
    public int? StatusCode { get; set; }
    public long? DurationMs { get; set; }
    public int? Concurrency { get; set; }
    public string? Source { get; set; }
    public string? MetadataJson { get; set; }
}
