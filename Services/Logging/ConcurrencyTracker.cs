namespace Api.Services.Logging;

public class ConcurrencyTracker
{
    private int _inflight;
    private int _peak;

    public int Current => Volatile.Read(ref _inflight);
    public int Peak => Volatile.Read(ref _peak);

    public int Increment()
    {
        var v = Interlocked.Increment(ref _inflight);
        var peak = _peak;
        while (v > peak && Interlocked.CompareExchange(ref _peak, v, peak) != peak)
        {
            peak = _peak;
        }
        return v;
    }

    public int Decrement() => Interlocked.Decrement(ref _inflight);
}
