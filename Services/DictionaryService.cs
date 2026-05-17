using System.Text.Json;
using System.Text.RegularExpressions;
using Api.Data;
using Api.DTOs.Responses;
using Api.Models;
using Api.Services.Logging;
using Microsoft.EntityFrameworkCore;

namespace Api.Services;

public class DictionaryService(IHttpClientFactory httpFactory, AppDbContext db, ILogger<DictionaryService> log, IEventLog events)
{
    private static readonly TimeSpan CacheTtl = TimeSpan.FromDays(30);

    public async Task<WordLookupResponse?> LookupAsync(string word)
    {
        var normalized = word.Trim();
        if (string.IsNullOrWhiteSpace(normalized)) return null;
        var key = normalized.ToLowerInvariant();

        var cached = await db.WordCache.FirstOrDefaultAsync(w => w.Word == key);
        if (cached is not null && DateTime.UtcNow - cached.CachedAt < CacheTtl)
        {
            events.Info("cache.hit", "word_cache", metadata: new { key });
            return JsonSerializer.Deserialize<WordLookupResponse>(cached.PayloadJson);
        }
        events.Info("cache.miss", "word_cache", metadata: new { key });

        var http = httpFactory.CreateClient();
        http.DefaultRequestHeaders.UserAgent.ParseAdd("aufgehts/1.0 (German learning app)");

        var (definitions, gender, plural) = await FetchWiktionaryAsync(http, normalized);
        var translation = await FetchTranslationAsync(http, normalized);

        var result = new WordLookupResponse(
            Word: normalized,
            Translation: translation,
            Gender: gender,
            Plural: plural,
            Definitions: definitions,
            Alternatives: []
        );

        var payload = JsonSerializer.Serialize(result);
        if (cached is null)
        {
            db.WordCache.Add(new WordCache { Word = key, PayloadJson = payload });
        }
        else
        {
            cached.PayloadJson = payload;
            cached.CachedAt = DateTime.UtcNow;
        }
        try { await db.SaveChangesAsync(); }
        catch (Exception ex) { log.LogWarning(ex, "Failed to cache word lookup"); }

        return result;
    }

    private async Task<(List<WordDefinition> defs, string? gender, string? plural)> FetchWiktionaryAsync(HttpClient http, string word)
    {
        var url = $"https://en.wiktionary.org/api/rest_v1/page/definition/{Uri.EscapeDataString(word)}";
        try
        {
            var res = await http.GetAsync(url);
            if (!res.IsSuccessStatusCode) return ([], null, null);
            var json = await res.Content.ReadAsStringAsync();
            using var doc = JsonDocument.Parse(json);

            if (!doc.RootElement.TryGetProperty("de", out var deSection))
                return ([], null, null);

            var defs = new List<WordDefinition>();
            string? gender = null;
            string? plural = null;

            foreach (var partOfSpeech in deSection.EnumerateArray())
            {
                var pos = partOfSpeech.TryGetProperty("partOfSpeech", out var p) ? p.GetString() ?? "" : "";

                if (partOfSpeech.TryGetProperty("language", out _))
                {
                    var lang = partOfSpeech.GetProperty("language").GetString();
                    if (lang != "German") continue;
                }

                if (partOfSpeech.TryGetProperty("definitions", out var defsArr))
                {
                    foreach (var def in defsArr.EnumerateArray())
                    {
                        var text = def.TryGetProperty("definition", out var d) ? StripHtml(d.GetString() ?? "") : "";
                        var examples = new List<string>();
                        if (def.TryGetProperty("examples", out var exArr))
                        {
                            foreach (var ex in exArr.EnumerateArray())
                            {
                                examples.Add(StripHtml(ex.GetString() ?? ""));
                            }
                        }

                        // Try to extract gender + plural from definition text (typically: "f (genitive ..., plural ...)")
                        if (gender is null && pos.Contains("Noun", StringComparison.OrdinalIgnoreCase))
                        {
                            gender = ExtractGender(text);
                        }
                        if (plural is null)
                        {
                            plural = ExtractPlural(text);
                        }

                        if (!string.IsNullOrWhiteSpace(text))
                        {
                            defs.Add(new WordDefinition(pos, text, examples));
                        }
                    }
                }
            }

            return (defs, gender, plural);
        }
        catch (Exception ex)
        {
            log.LogWarning(ex, "Wiktionary fetch failed for {Word}", word);
            return ([], null, null);
        }
    }

    private async Task<string?> FetchTranslationAsync(HttpClient http, string word)
    {
        var url = $"https://api.mymemory.translated.net/get?q={Uri.EscapeDataString(word)}&langpair=de|en";
        try
        {
            var res = await http.GetAsync(url);
            if (!res.IsSuccessStatusCode) return null;
            var json = await res.Content.ReadAsStringAsync();
            using var doc = JsonDocument.Parse(json);
            if (doc.RootElement.TryGetProperty("responseData", out var rd)
                && rd.TryGetProperty("translatedText", out var t))
            {
                return t.GetString();
            }
            return null;
        }
        catch (Exception ex)
        {
            log.LogWarning(ex, "Translation fetch failed for {Word}", word);
            return null;
        }
    }

    private static string StripHtml(string input) =>
        Regex.Replace(input, "<.*?>", "").Replace("&quot;", "\"").Replace("&amp;", "&").Trim();

    private static string? ExtractGender(string definitionText)
    {
        var match = Regex.Match(definitionText, @"\b(masculine|feminine|neuter)\b", RegexOptions.IgnoreCase);
        if (!match.Success) return null;
        return match.Value.ToLowerInvariant() switch
        {
            "masculine" => "der",
            "feminine" => "die",
            "neuter" => "das",
            _ => null
        };
    }

    private static string? ExtractPlural(string definitionText)
    {
        var match = Regex.Match(definitionText, @"plural\s+([A-Za-zäöüÄÖÜß]+)", RegexOptions.IgnoreCase);
        return match.Success ? match.Groups[1].Value : null;
    }
}
