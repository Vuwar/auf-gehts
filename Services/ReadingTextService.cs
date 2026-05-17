using System.Text.Json;
using Api.Data;
using Api.DTOs.Requests;
using Api.DTOs.Responses;
using Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Api.Services;

public class ReadingTextService(AppDbContext db, CurrentUserAccessor currentUser)
{
    public async Task<List<ReadingTextResponse>> ListAsync(Guid userId)
    {
        var rows = await db.ReadingTexts
            .OrderByDescending(t => t.CreatedAt)
            .Select(t => new
            {
                t.Id, t.Title, t.Content, t.Level, t.WeekId, t.CreatedByUserId, t.CreatedAt,
                WeekNumber = t.Week != null ? (int?)t.Week.Number : null,
                CreatorName = db.Users.Where(u => u.Id == t.CreatedByUserId).Select(u => u.DisplayName ?? u.Email).FirstOrDefault(),
                Questions = t.Questions.OrderBy(q => q.DisplayOrder).ToList()
            })
            .ToListAsync();

        return rows.Select(r => new ReadingTextResponse(
            r.Id, r.Title, r.Content, r.Level, r.WeekId, r.WeekNumber,
            r.CreatedByUserId, r.CreatorName,
            r.CreatedByUserId == userId,
            r.CreatedAt,
            r.Questions.Select(MapQuestion).ToList()
        )).ToList();
    }

    public async Task<ReadingTextResponse?> GetAsync(Guid id, Guid userId)
    {
        var t = await db.ReadingTexts
            .Include(x => x.Questions)
            .Include(x => x.Week)
            .FirstOrDefaultAsync(x => x.Id == id);
        if (t is null) return null;
        var creatorName = await db.Users.Where(u => u.Id == t.CreatedByUserId).Select(u => u.DisplayName ?? u.Email).FirstOrDefaultAsync();
        return new ReadingTextResponse(
            t.Id, t.Title, t.Content, t.Level, t.WeekId, t.Week?.Number,
            t.CreatedByUserId, creatorName, t.CreatedByUserId == userId, t.CreatedAt,
            t.Questions.OrderBy(q => q.DisplayOrder).Select(MapQuestion).ToList()
        );
    }

    public async Task<ReadingTextResponse?> CreateAsync(CreateReadingTextRequest req, Guid userId)
    {
        var user = await currentUser.GetAsync();
        if (user?.Role == UserRole.ViewOnly) return null;

        var entity = new ReadingText
        {
            Title = req.Title.Trim(),
            Content = req.Content,
            Level = req.Level,
            WeekId = req.WeekId,
            CreatedByUserId = userId,
        };
        if (req.Questions is not null)
        {
            int order = 0;
            foreach (var q in req.Questions)
            {
                if (string.IsNullOrWhiteSpace(q.Prompt)) continue;
                entity.Questions.Add(new ReadingTextQuestion
                {
                    DisplayOrder = order++,
                    Type = ParseType(q.Type),
                    Prompt = q.Prompt.Trim(),
                    OptionsJson = q.Options is null ? null : JsonSerializer.Serialize(q.Options),
                    CorrectAnswer = q.CorrectAnswer?.Trim(),
                });
            }
        }
        db.ReadingTexts.Add(entity);
        await db.SaveChangesAsync();
        return await GetAsync(entity.Id, userId);
    }

    public async Task<bool> DeleteAsync(Guid id, Guid userId)
    {
        var user = await currentUser.GetAsync();
        var entity = await db.ReadingTexts.FirstOrDefaultAsync(t => t.Id == id);
        if (entity is null) return false;
        if (user?.Role != UserRole.Admin && entity.CreatedByUserId != userId) return false;
        db.ReadingTexts.Remove(entity);
        await db.SaveChangesAsync();
        return true;
    }

    private static ReadingTextQuestionResponse MapQuestion(ReadingTextQuestion q)
    {
        List<string>? options = null;
        if (!string.IsNullOrEmpty(q.OptionsJson))
        {
            try { options = JsonSerializer.Deserialize<List<string>>(q.OptionsJson); }
            catch { options = null; }
        }
        return new ReadingTextQuestionResponse(q.Id, q.DisplayOrder, q.Type.ToString(), q.Prompt, options, q.CorrectAnswer);
    }

    private static ReadingQuestionType ParseType(string s) => s?.Trim().ToLowerInvariant() switch
    {
        "multiplechoice" or "mc" => ReadingQuestionType.MultipleChoice,
        "truefalse" or "tf" => ReadingQuestionType.TrueFalse,
        "shortanswer" or "short" => ReadingQuestionType.ShortAnswer,
        "freetext" or "free" => ReadingQuestionType.FreeText,
        _ => ReadingQuestionType.FreeText,
    };
}
