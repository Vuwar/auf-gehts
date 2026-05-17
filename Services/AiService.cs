using System.Text;
using System.Text.Json;
using Api.Data;
using Api.DTOs.Requests;
using Api.DTOs.Responses;
using Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Api.Services;

public class AiService(
    IHttpClientFactory httpFactory,
    AppDbContext db,
    UserService userService,
    IConfiguration config,
    ILogger<AiService> log)
{
    private const int GenerateDailyLimit = 50;
    private const int TranslateDailyLimit = 150;
    private const string GenerateModel = "llama-3.3-70b-versatile";
    private const string TranslateModel = "llama-3.1-8b-instant";
    private const string Endpoint = "https://api.groq.com/openai/v1/chat/completions";

    public async Task<GeneratedTextResponse?> GenerateTextAsync(GenerateTextRequest req, Guid userId)
    {
        var user = await userService.GetAsync(userId);
        if (user is null) return null;

        var apiKey = ResolveKey(user);
        var useFreeQuota = string.IsNullOrEmpty(user.AnthropicApiKey);

        if (useFreeQuota)
        {
            if (string.IsNullOrEmpty(apiKey)) throw new InvalidOperationException("No API key configured");
            await ConsumeAsync(userId, AiUsageKind.Generate);
        }

        var prompt = BuildPrompt(req);
        var text = await CallGroqAsync(apiKey!, GenerateModel, prompt, 800);

        int remaining = useFreeQuota ? await CalculateRemainingAsync(userId, AiUsageKind.Generate) : -1;
        return new GeneratedTextResponse(text, remaining);
    }

    public async Task<string?> TranslateAsync(string text, Guid userId)
    {
        var user = await userService.GetAsync(userId);
        if (user is null) return null;
        var apiKey = ResolveKey(user);
        if (string.IsNullOrEmpty(apiKey)) throw new InvalidOperationException("No API key configured");

        if (string.IsNullOrEmpty(user.AnthropicApiKey))
        {
            await ConsumeAsync(userId, AiUsageKind.Translate);
        }

        var prompt = $"Translate the following German text to English. Return ONLY the English translation, no commentary:\n\n{text}";
        return await CallGroqAsync(apiKey, TranslateModel, prompt, 400);
    }

    public async Task<(int GenerateRemaining, int TranslateRemaining)> GetRemainingTodayAsync(Guid userId)
    {
        var user = await userService.GetAsync(userId);
        if (user?.AnthropicApiKey is not null) return (-1, -1);
        return (
            await CalculateRemainingAsync(userId, AiUsageKind.Generate),
            await CalculateRemainingAsync(userId, AiUsageKind.Translate));
    }

    private string? ResolveKey(User user)
        => user.AnthropicApiKey ?? config["Groq:ApiKey"] ?? config["Gemini:ApiKey"];

    private enum AiUsageKind { Generate, Translate }

    private async Task ConsumeAsync(Guid userId, AiUsageKind kind)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var usage = await db.AiUsage.FirstOrDefaultAsync(u => u.UserId == userId && u.Date == today);
        if (usage is null)
        {
            usage = new AiUsage { UserId = userId, Date = today };
            db.AiUsage.Add(usage);
        }

        if (kind == AiUsageKind.Generate)
        {
            if (usage.GenerateCount >= GenerateDailyLimit)
                throw new InvalidOperationException($"Daily generate limit reached ({GenerateDailyLimit}). Add your own API key in profile settings for unlimited usage.");
            usage.GenerateCount++;
        }
        else
        {
            if (usage.TranslateCount >= TranslateDailyLimit)
                throw new InvalidOperationException($"Daily translate limit reached ({TranslateDailyLimit}). Add your own API key in profile settings for unlimited usage.");
            usage.TranslateCount++;
        }

        await db.SaveChangesAsync();
    }

    private async Task<int> CalculateRemainingAsync(Guid userId, AiUsageKind kind)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var usage = await db.AiUsage.FirstOrDefaultAsync(u => u.UserId == userId && u.Date == today);
        var (used, limit) = kind == AiUsageKind.Generate
            ? (usage?.GenerateCount ?? 0, GenerateDailyLimit)
            : (usage?.TranslateCount ?? 0, TranslateDailyLimit);
        return Math.Max(0, limit - used);
    }

    private static string BuildPrompt(GenerateTextRequest req)
    {
        var sb = new StringBuilder();
        sb.AppendLine($"Generate a short German text at CEFR level {req.Level} about: {req.Topic}.");
        sb.AppendLine($"Target length: ~{req.WordCount ?? 150} words.");
        if (req.WordsToInclude is { Count: > 0 })
        {
            sb.AppendLine($"Must include these words naturally: {string.Join(", ", req.WordsToInclude)}.");
        }
        sb.AppendLine("Return ONLY the German text, no commentary, no translation, no preamble.");
        return sb.ToString();
    }

    private async Task<string> CallGroqAsync(string apiKey, string model, string prompt, int maxTokens)
    {
        var http = httpFactory.CreateClient();

        var body = new
        {
            model,
            max_tokens = maxTokens,
            temperature = 0.7,
            messages = new[]
            {
                new { role = "user", content = prompt }
            }
        };

        using var request = new HttpRequestMessage(HttpMethod.Post, Endpoint)
        {
            Content = new StringContent(JsonSerializer.Serialize(body), Encoding.UTF8, "application/json")
        };
        request.Headers.Add("Authorization", $"Bearer {apiKey}");

        var res = await http.SendAsync(request);
        var json = await res.Content.ReadAsStringAsync();

        if (!res.IsSuccessStatusCode)
        {
            log.LogError("Groq API error: {Status} {Body}", res.StatusCode, json);
            throw new InvalidOperationException($"Groq API error: {res.StatusCode}");
        }

        using var doc = JsonDocument.Parse(json);
        var text = doc.RootElement
            .GetProperty("choices")[0]
            .GetProperty("message")
            .GetProperty("content")
            .GetString() ?? "";
        return text.Trim();
    }
}
