using System.Threading.Channels;
using Api.Data;
using Api.Models;
using Microsoft.EntityFrameworkCore;

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
                log.LogError(ex, "EventLogWorker batch failure");
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

    private async Task FlushAsync(List<EventLog> batch, CancellationToken ct)
    {
        using var scope = scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        await db.EventLogs.AddRangeAsync(batch, ct);
        await db.SaveChangesAsync(ct);
    }
}
