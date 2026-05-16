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
    private const int DailyFreeLimit = 10;
    private const string Model = "claude-haiku-4-5-20251001";

    public async Task<GeneratedTextResponse?> GenerateTextAsync(GenerateTextRequest req, Guid userId)
    {
        var user = await userService.GetAsync(userId);
        if (user is null) return null;

        var apiKey = user.AnthropicApiKey ?? config["Anthropic:ApiKey"];
        var useFreeQuota = string.IsNullOrEmpty(user.AnthropicApiKey);

        if (useFreeQuota)
        {
            if (string.IsNullOrEmpty(apiKey)) throw new InvalidOperationException("No API key configured");
            var today = DateOnly.FromDateTime(DateTime.UtcNow);
            var usage = await db.AiUsage.FirstOrDefaultAsync(u => u.UserId == userId && u.Date == today);
            if (usage is null)
            {
                usage = new AiUsage { UserId = userId, Date = today, RequestCount = 0 };
                db.AiUsage.Add(usage);
            }
            if (usage.RequestCount >= DailyFreeLimit)
            {
                throw new InvalidOperationException($"Daily limit reached ({DailyFreeLimit}). Add your own Anthropic API key in profile settings for unlimited usage.");
            }
            usage.RequestCount++;
            await db.SaveChangesAsync();
        }

        var prompt = BuildPrompt(req);
        var text = await CallClaudeAsync(apiKey!, prompt);

        int remaining = useFreeQuota ? await CalculateRemainingAsync(userId) : -1;
        return new GeneratedTextResponse(text, remaining);
    }

    public async Task<int> GetRemainingTodayAsync(Guid userId)
    {
        var user = await userService.GetAsync(userId);
        if (user?.AnthropicApiKey is not null) return -1; // unlimited with BYOK
        return await CalculateRemainingAsync(userId);
    }

    private async Task<int> CalculateRemainingAsync(Guid userId)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var usage = await db.AiUsage.FirstOrDefaultAsync(u => u.UserId == userId && u.Date == today);
        return Math.Max(0, DailyFreeLimit - (usage?.RequestCount ?? 0));
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

    private async Task<string> CallClaudeAsync(string apiKey, string prompt)
    {
        var http = httpFactory.CreateClient();
        http.DefaultRequestHeaders.Add("x-api-key", apiKey);
        http.DefaultRequestHeaders.Add("anthropic-version", "2023-06-01");

        var body = new
        {
            model = Model,
            max_tokens = 800,
            messages = new[] { new { role = "user", content = prompt } }
        };

        var content = new StringContent(JsonSerializer.Serialize(body), Encoding.UTF8, "application/json");
        var res = await http.PostAsync("https://api.anthropic.com/v1/messages", content);
        var json = await res.Content.ReadAsStringAsync();

        if (!res.IsSuccessStatusCode)
        {
            log.LogError("Anthropic API error: {Status} {Body}", res.StatusCode, json);
            throw new InvalidOperationException($"Anthropic API error: {res.StatusCode}");
        }

        using var doc = JsonDocument.Parse(json);
        var text = doc.RootElement
            .GetProperty("content")[0]
            .GetProperty("text")
            .GetString() ?? "";
        return text.Trim();
    }
}
