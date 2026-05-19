namespace Api.Services.Audio;

public interface IAudioStorage
{
    bool Enabled { get; }
    Task<UploadedAudio> UploadAsync(byte[] bytes, string contentType, string objectKey, CancellationToken ct);
    Task DeleteAsync(string objectKey, CancellationToken ct);
}

public record UploadedAudio(string Url, string Path);
