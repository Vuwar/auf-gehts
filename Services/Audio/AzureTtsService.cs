using System.Net.Http.Headers;
using System.Text;
using System.Text.RegularExpressions;
using Microsoft.Extensions.Options;

namespace Api.Services.Audio;

public class AzureTtsService(IHttpClientFactory httpClientFactory, IOptions<AzureSpeechOptions> options, ILogger<AzureTtsService> logger) : ITtsService
{
    private const int MaxCharsPerChunk = 4500;
    private const int MaxChunks = 30;
    private const double CharsPerSecondEstimate = 14.0;
    private static readonly TimeSpan RequestTimeout = TimeSpan.FromSeconds(30);

    private readonly AzureSpeechOptions _opts = options.Value;

    public bool Enabled =>
        !string.IsNullOrWhiteSpace(_opts.Key) && !string.IsNullOrWhiteSpace(_opts.Region);

    public async Task<TtsResult?> SynthesizeAsync(string text, string lang, CancellationToken ct)
    {
        if (!Enabled) return null;
        if (string.IsNullOrWhiteSpace(text)) return null;

        var chunks = ChunkText(text, MaxCharsPerChunk).Take(MaxChunks).ToList();
        var buffers = new List<byte[]>(chunks.Count);

        foreach (var chunk in chunks)
        {
            var bytes = await SynthesizeChunkAsync(chunk, lang, ct);
            if (bytes is null) return null;
            buffers.Add(bytes);
        }

        var total = buffers.Sum(b => b.Length);
        var combined = new byte[total];
        var offset = 0;
        foreach (var b in buffers)
        {
            Buffer.BlockCopy(b, 0, combined, offset, b.Length);
            offset += b.Length;
        }

        var durationSec = (int)Math.Ceiling(text.Length / CharsPerSecondEstimate);
        var voiceTag = $"azure:{_opts.Voice}";
        return new TtsResult(combined, "audio/mpeg", durationSec, voiceTag);
    }

    private async Task<byte[]?> SynthesizeChunkAsync(string text, string lang, CancellationToken ct)
    {
        var client = httpClientFactory.CreateClient(nameof(AzureTtsService));
        client.Timeout = RequestTimeout;

        var endpoint = $"https://{_opts.Region}.tts.speech.microsoft.com/cognitiveservices/v1";
        var ssml = BuildSsml(text, lang);

        using var req = new HttpRequestMessage(HttpMethod.Post, endpoint);
        req.Headers.TryAddWithoutValidation("Ocp-Apim-Subscription-Key", _opts.Key);
        req.Headers.TryAddWithoutValidation("X-Microsoft-OutputFormat", _opts.Format);
        req.Headers.UserAgent.ParseAdd("aufgehts/1.0");
        req.Content = new StringContent(ssml, Encoding.UTF8);
        req.Content.Headers.ContentType = new MediaTypeHeaderValue("application/ssml+xml");

        try
        {
            using var resp = await client.SendAsync(req, ct);
            if (!resp.IsSuccessStatusCode)
            {
                var body = await resp.Content.ReadAsStringAsync(ct);
                logger.LogWarning("Azure TTS failed: {Status} {Body}", resp.StatusCode, body);
                return null;
            }
            return await resp.Content.ReadAsByteArrayAsync(ct);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Azure TTS request errored");
            return null;
        }
    }

    private string BuildSsml(string text, string lang)
    {
        var escaped = SecurityElement(text);
        var resolvedLang = string.IsNullOrWhiteSpace(lang) ? _opts.Language : lang;
        return $"<speak version=\"1.0\" xml:lang=\"{resolvedLang}\"><voice name=\"{_opts.Voice}\">{escaped}</voice></speak>";
    }

    private static string SecurityElement(string s) =>
        s.Replace("&", "&amp;")
         .Replace("<", "&lt;")
         .Replace(">", "&gt;")
         .Replace("\"", "&quot;")
         .Replace("'", "&apos;");

    private static IEnumerable<string> ChunkText(string text, int maxChars)
    {
        if (text.Length <= maxChars)
        {
            yield return text;
            yield break;
        }

        var sentences = Regex.Split(text, @"(?<=[\.\!\?])\s+");
        var buffer = new StringBuilder();
        foreach (var sentence in sentences)
        {
            if (buffer.Length + sentence.Length + 1 > maxChars && buffer.Length > 0)
            {
                yield return buffer.ToString().TrimEnd();
                buffer.Clear();
            }
            if (sentence.Length > maxChars)
            {
                for (var i = 0; i < sentence.Length; i += maxChars)
                {
                    var slice = sentence.Substring(i, Math.Min(maxChars, sentence.Length - i));
                    yield return slice;
                }
                continue;
            }
            buffer.Append(sentence);
            buffer.Append(' ');
        }
        if (buffer.Length > 0) yield return buffer.ToString().TrimEnd();
    }
}
