using System.Net.Http.Headers;

namespace Api.Services.Audio;

public class SupabaseAudioStorage(IHttpClientFactory httpClientFactory, IConfiguration config, ILogger<SupabaseAudioStorage> logger) : IAudioStorage
{
    private static readonly TimeSpan RequestTimeout = TimeSpan.FromSeconds(30);

    private string? ProjectRef => config["Supabase:ProjectRef"];
    private string? ServiceRoleKey => config["Supabase:ServiceRoleKey"];
    private string Bucket => config["Supabase:AudioBucket"] ?? "passage-audio";

    public bool Enabled =>
        !string.IsNullOrWhiteSpace(ProjectRef) && !string.IsNullOrWhiteSpace(ServiceRoleKey);

    public async Task<UploadedAudio> UploadAsync(byte[] bytes, string contentType, string objectKey, CancellationToken ct)
    {
        if (!Enabled)
            throw new InvalidOperationException("Supabase audio storage not configured");

        var client = httpClientFactory.CreateClient(nameof(SupabaseAudioStorage));
        client.Timeout = RequestTimeout;

        var url = $"https://{ProjectRef}.supabase.co/storage/v1/object/{Bucket}/{objectKey}";
        using var req = new HttpRequestMessage(HttpMethod.Put, url);
        req.Headers.TryAddWithoutValidation("Authorization", $"Bearer {ServiceRoleKey}");
        req.Headers.TryAddWithoutValidation("x-upsert", "true");
        req.Content = new ByteArrayContent(bytes);
        req.Content.Headers.ContentType = new MediaTypeHeaderValue(contentType);

        using var resp = await client.SendAsync(req, ct);
        if (!resp.IsSuccessStatusCode)
        {
            var body = await resp.Content.ReadAsStringAsync(ct);
            logger.LogWarning("Supabase storage upload failed: {Status} {Body}", resp.StatusCode, body);
            throw new InvalidOperationException($"Supabase storage upload failed: {(int)resp.StatusCode}");
        }

        var publicUrl = $"https://{ProjectRef}.supabase.co/storage/v1/object/public/{Bucket}/{objectKey}";
        return new UploadedAudio(publicUrl, objectKey);
    }

    public async Task DeleteAsync(string objectKey, CancellationToken ct)
    {
        if (!Enabled || string.IsNullOrWhiteSpace(objectKey)) return;

        var client = httpClientFactory.CreateClient(nameof(SupabaseAudioStorage));
        client.Timeout = RequestTimeout;

        var url = $"https://{ProjectRef}.supabase.co/storage/v1/object/{Bucket}/{objectKey}";
        using var req = new HttpRequestMessage(HttpMethod.Delete, url);
        req.Headers.TryAddWithoutValidation("Authorization", $"Bearer {ServiceRoleKey}");

        try
        {
            using var resp = await client.SendAsync(req, ct);
            if (!resp.IsSuccessStatusCode && resp.StatusCode != System.Net.HttpStatusCode.NotFound)
            {
                var body = await resp.Content.ReadAsStringAsync(ct);
                logger.LogWarning("Supabase storage delete failed: {Status} {Body}", resp.StatusCode, body);
            }
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Supabase storage delete errored");
        }
    }
}
