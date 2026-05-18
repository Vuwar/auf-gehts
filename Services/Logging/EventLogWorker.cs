using System.Data;
using System.Threading.Channels;
using Api.Data;
using Api.Models;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using NpgsqlTypes;

namespace Api.Services.Logging;

public class EventLogWorker(
    Channel<EventLog> channel,
    IServiceScopeFactory scopeFactory,
    ILogger<EventLogWorker> log) : BackgroundService
{
    private const int BatchSize = 50;
    private static readonly TimeSpan FlushInterval = TimeSpan.FromSeconds(2);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var reader = channel.Reader;
        var buffer = new List<EventLog>(BatchSize);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using var cts = CancellationTokenSource.CreateLinkedTokenSource(stoppingToken);
                cts.CancelAfter(FlushInterval);

                try
                {
                    while (buffer.Count < BatchSize && await reader.WaitToReadAsync(cts.Token))
                    {
                        while (buffer.Count < BatchSize && reader.TryRead(out var entry))
                        {
                            buffer.Add(entry);
                        }
                    }
                }
                catch (OperationCanceledException) when (!stoppingToken.IsCancellationRequested)
                {
                    // Flush interval tick, fall through to write.
                }

                if (buffer.Count == 0) continue;

                await FlushAsync(buffer, stoppingToken);
                buffer.Clear();
            }
            catch (OperationCanceledException) { break; }
            catch (Exception ex)
            {
                log.LogError(ex, "EventLogWorker batch failure (dropped {Count} events)", buffer.Count);
                buffer.Clear();
                await Task.Delay(TimeSpan.FromSeconds(5), stoppingToken);
            }
        }

        // Drain on shutdown.
        if (buffer.Count > 0)
        {
            try { await FlushAsync(buffer, CancellationToken.None); }
            catch (Exception ex) { log.LogError(ex, "Final flush failed"); }
        }
    }

    // Uses Npgsql binary COPY instead of EF Core multi-row INSERT — 5–10× faster for
    // append-only bulk writes. Drawbacks for this table are minimal: no change tracking
    // is needed, no FK constraints, and `Id` / `Timestamp` defaults aren't used (we
    // supply Timestamp from C#, and Id is omitted so Postgres auto-generates it).
    private async Task FlushAsync(List<EventLog> batch, CancellationToken ct)
    {
        using var scope = scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var conn = (NpgsqlConnection)db.Database.GetDbConnection();
        if (conn.State != ConnectionState.Open) await conn.OpenAsync(ct);

        const string copyCmd =
            "COPY event_logs (\"Timestamp\", \"Level\", \"EventType\", \"Message\", " +
            "\"TraceId\", \"UserId\", \"Endpoint\", \"HttpMethod\", \"StatusCode\", " +
            "\"DurationMs\", \"Concurrency\", \"Source\", \"MetadataJson\") " +
            "FROM STDIN (FORMAT BINARY)";

        await using var writer = await conn.BeginBinaryImportAsync(copyCmd, ct);
        foreach (var e in batch)
        {
            await writer.StartRowAsync(ct);

            // Timestamp must be DateTimeKind.Utc for `timestamp with time zone` in Npgsql 8+.
            var ts = e.Timestamp.Kind == DateTimeKind.Utc ? e.Timestamp : e.Timestamp.ToUniversalTime();
            await writer.WriteAsync(ts, NpgsqlDbType.TimestampTz, ct);

            await writer.WriteAsync((int)e.Level, NpgsqlDbType.Integer, ct);
            await writer.WriteAsync(e.EventType, NpgsqlDbType.Text, ct);

            await WriteNullableText(writer, e.Message, ct);
            await WriteNullableText(writer, e.TraceId, ct);
            await WriteNullableUuid(writer, e.UserId, ct);
            await WriteNullableText(writer, e.Endpoint, ct);
            await WriteNullableText(writer, e.HttpMethod, ct);
            await WriteNullableInt(writer, e.StatusCode, ct);
            await WriteNullableBigint(writer, e.DurationMs, ct);
            await WriteNullableInt(writer, e.Concurrency, ct);
            await WriteNullableText(writer, e.Source, ct);
            await WriteNullableText(writer, e.MetadataJson, ct);
        }

        await writer.CompleteAsync(ct);
    }

    private static async Task WriteNullableText(NpgsqlBinaryImporter w, string? v, CancellationToken ct)
    {
        if (v is null) await w.WriteNullAsync(ct);
        else await w.WriteAsync(v, NpgsqlDbType.Text, ct);
    }

    private static async Task WriteNullableUuid(NpgsqlBinaryImporter w, Guid? v, CancellationToken ct)
    {
        if (v is null) await w.WriteNullAsync(ct);
        else await w.WriteAsync(v.Value, NpgsqlDbType.Uuid, ct);
    }

    private static async Task WriteNullableInt(NpgsqlBinaryImporter w, int? v, CancellationToken ct)
    {
        if (v is null) await w.WriteNullAsync(ct);
        else await w.WriteAsync(v.Value, NpgsqlDbType.Integer, ct);
    }

    private static async Task WriteNullableBigint(NpgsqlBinaryImporter w, long? v, CancellationToken ct)
    {
        if (v is null) await w.WriteNullAsync(ct);
        else await w.WriteAsync(v.Value, NpgsqlDbType.Bigint, ct);
    }
}
