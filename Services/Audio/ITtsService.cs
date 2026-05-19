namespace Api.Services.Audio;

public interface ITtsService
{
    bool Enabled { get; }
    Task<TtsResult?> SynthesizeAsync(string text, string lang, CancellationToken ct);
}

public record TtsResult(byte[] Bytes, string ContentType, int? DurationSec, string VoiceTag);
