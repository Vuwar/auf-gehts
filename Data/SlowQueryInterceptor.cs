using System.Data.Common;
using Api.Services.Logging;
using Microsoft.EntityFrameworkCore.Diagnostics;

namespace Api.Data;

public class SlowQueryInterceptor(IEventLog log) : DbCommandInterceptor
{
    private const long SlowQueryMs = 200;

    public override ValueTask<DbDataReader> ReaderExecutedAsync(
        DbCommand command, CommandExecutedEventData eventData, DbDataReader result,
        CancellationToken cancellationToken = default)
    {
        Track(eventData);
        return base.ReaderExecutedAsync(command, eventData, result, cancellationToken);
    }

    public override ValueTask<int> NonQueryExecutedAsync(
        DbCommand command, CommandExecutedEventData eventData, int result,
        CancellationToken cancellationToken = default)
    {
        Track(eventData);
        return base.NonQueryExecutedAsync(command, eventData, result, cancellationToken);
    }

    public override ValueTask<object?> ScalarExecutedAsync(
        DbCommand command, CommandExecutedEventData eventData, object? result,
        CancellationToken cancellationToken = default)
    {
        Track(eventData);
        return base.ScalarExecutedAsync(command, eventData, result, cancellationToken);
    }

    public override Task CommandFailedAsync(
        DbCommand command, CommandErrorEventData eventData,
        CancellationToken cancellationToken = default)
    {
        log.Error("db.query_failed", eventData.Exception.Message,
            metadata: new
            {
                durationMs = (long)eventData.Duration.TotalMilliseconds,
                commandText = Truncate(command.CommandText, 500),
                exception = eventData.Exception.GetType().Name,
            });
        return base.CommandFailedAsync(command, eventData, cancellationToken);
    }

    private void Track(CommandExecutedEventData data)
    {
        var ms = (long)data.Duration.TotalMilliseconds;
        if (ms < SlowQueryMs) return;
        log.Warn("db.slow_query", $"Slow query ({ms}ms)",
            metadata: new
            {
                durationMs = ms,
                commandText = Truncate(data.Command.CommandText, 500),
            });
    }

    private static string Truncate(string s, int max) => s.Length <= max ? s : s.Substring(0, max) + "...";
}
