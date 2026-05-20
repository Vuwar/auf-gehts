using System.Text;
using System.Text.Json;
using Api.Data;
using Api.DTOs.Requests;
using Api.DTOs.Responses;
using Api.Mappings;
using Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Api.Services;

public class TagService(
    AppDbContext db,
    CurrentUserAccessor currentUser,
    AiService ai,
    ReadingTextService readingService)
{
    public const int TotalSteps = 6;
    public const int AllStepsMask = (1 << TotalSteps) - 1;

    public async Task<List<TagResponse>> ListAsync(Guid weekId, Guid userId)
    {
        var tags = await db.Tags
            .Where(t => t.WeekId == weekId)
            .OrderBy(t => t.TagNumber)
            .Select(t => new
            {
                Tag = t,
                WordSet = t.WordSet,
                ReadingText = t.ReadingText,
                WordCount = t.WordSet != null ? (int?)t.WordSet.Words.Count : null,
                QuestionCount = t.ReadingText != null ? t.ReadingText.Questions.Count : 0,
                HasAudio = t.ReadingText != null && t.ReadingText.AudioUrl != null,
            })
            .ToListAsync();

        var tagIds = tags.Select(x => x.Tag.Id).ToList();
        var progressByTag = await db.UserTagProgress
            .Where(p => p.UserId == userId && tagIds.Contains(p.TagId))
            .ToDictionaryAsync(p => p.TagId);

        return tags.Select(x =>
        {
            progressByTag.TryGetValue(x.Tag.Id, out var p);
            var mask = p?.CompletedStepsMask ?? 0;
            return new TagResponse(
                x.Tag.Id, x.Tag.WeekId, x.Tag.TagNumber, x.Tag.Name,
                x.Tag.WordSetId, x.WordSet?.Name, x.WordCount,
                x.Tag.ReadingTextId, x.ReadingText?.Title,
                x.QuestionCount, x.HasAudio,
                mask, p?.LastStep ?? 0, mask == AllStepsMask
            );
        }).ToList();
    }

    public async Task<TagDetailResponse?> GetDetailAsync(Guid tagId, Guid userId)
    {
        var tag = await db.Tags
            .Include(t => t.Week)
            .Include(t => t.WordSet).ThenInclude(s => s!.Words)
            .Include(t => t.ReadingText).ThenInclude(r => r!.Questions)
            .FirstOrDefaultAsync(t => t.Id == tagId);
        if (tag is null) return null;

        var locked = await IsWeekLockedAsync(tag.WeekId, userId);

        WordSetResponse? wsResp = null;
        var words = new List<WordResponse>();
        if (tag.WordSet is not null)
        {
            var prog = await db.UserSetProgress.FirstOrDefaultAsync(p => p.UserId == userId && p.WordSetId == tag.WordSet.Id);
            wsResp = tag.WordSet.ToResponse(userId, tag.WordSet.Words.Count, prog?.Status ?? ProgressStatus.NotStarted, prog?.IsFavorite ?? false);
            words = tag.WordSet.Words.OrderBy(w => w.DisplayOrder).ThenBy(w => w.CreatedAt).Select(w => w.ToResponse()).ToList();
        }

        ReadingTextResponse? rtResp = null;
        if (tag.ReadingText is not null)
        {
            rtResp = await readingService.GetAsync(tag.ReadingText.Id, userId);
        }

        var p = await db.UserTagProgress.FirstOrDefaultAsync(up => up.UserId == userId && up.TagId == tagId);
        var mask = p?.CompletedStepsMask ?? 0;

        return new TagDetailResponse(
            tag.Id, tag.WeekId, tag.Week.Number, tag.Week.Title,
            tag.TagNumber, tag.Name,
            wsResp, words, rtResp,
            mask, p?.LastStep ?? 0, mask == AllStepsMask,
            locked
        );
    }

    public async Task<(Tag? tag, string? error)> CreateAsync(Guid weekId, CreateTagRequest req)
    {
        var user = await currentUser.GetAsync();
        if (user?.Role != UserRole.Admin) return (null, "Admin only");
        var week = await db.Weeks.FirstOrDefaultAsync(w => w.Id == weekId);
        if (week is null) return (null, "Week not found");
        if (req.TagNumber < 1 || req.TagNumber > 7) return (null, "TagNumber must be 1-7");
        var exists = await db.Tags.AnyAsync(t => t.WeekId == weekId && t.TagNumber == req.TagNumber);
        if (exists) return (null, $"Tag {req.TagNumber} already exists for this week");

        var tag = new Tag
        {
            WeekId = weekId,
            TagNumber = req.TagNumber,
            Name = string.IsNullOrWhiteSpace(req.Name) ? $"Tag {req.TagNumber}" : req.Name.Trim(),
            WordSetId = req.WordSetId,
            ReadingTextId = req.ReadingTextId,
        };
        db.Tags.Add(tag);
        await db.SaveChangesAsync();
        return (tag, null);
    }

    public async Task<(Tag? tag, string? error)> UpdateAsync(Guid tagId, UpdateTagRequest req)
    {
        var user = await currentUser.GetAsync();
        if (user?.Role != UserRole.Admin) return (null, "Admin only");
        var tag = await db.Tags.FirstOrDefaultAsync(t => t.Id == tagId);
        if (tag is null) return (null, "Not found");

        if (req.TagNumber.HasValue && req.TagNumber.Value != tag.TagNumber)
        {
            if (req.TagNumber.Value < 1 || req.TagNumber.Value > 7) return (null, "TagNumber must be 1-7");
            var conflict = await db.Tags.AnyAsync(t => t.WeekId == tag.WeekId && t.TagNumber == req.TagNumber.Value && t.Id != tagId);
            if (conflict) return (null, $"Tag {req.TagNumber.Value} already exists");
            tag.TagNumber = req.TagNumber.Value;
        }
        if (!string.IsNullOrWhiteSpace(req.Name)) tag.Name = req.Name.Trim();
        if (req.ClearWordSet) tag.WordSetId = null;
        else if (req.WordSetId.HasValue) tag.WordSetId = req.WordSetId;
        if (req.ClearReadingText) tag.ReadingTextId = null;
        else if (req.ReadingTextId.HasValue) tag.ReadingTextId = req.ReadingTextId;

        await db.SaveChangesAsync();
        return (tag, null);
    }

    public async Task<bool> DeleteAsync(Guid tagId)
    {
        var user = await currentUser.GetAsync();
        if (user?.Role != UserRole.Admin) return false;
        var tag = await db.Tags.FirstOrDefaultAsync(t => t.Id == tagId);
        if (tag is null) return false;
        db.Tags.Remove(tag);
        await db.SaveChangesAsync();
        return true;
    }

    public async Task<UserTagProgress?> CompleteStepAsync(Guid tagId, Guid userId, int stepIndex)
    {
        if (stepIndex < 0 || stepIndex >= TotalSteps) return null;
        var tag = await db.Tags.FirstOrDefaultAsync(t => t.Id == tagId);
        if (tag is null) return null;
        if (await IsWeekLockedAsync(tag.WeekId, userId)) return null;

        var p = await db.UserTagProgress.FirstOrDefaultAsync(x => x.UserId == userId && x.TagId == tagId);
        var now = DateTime.UtcNow;
        var bit = 1 << stepIndex;
        if (p is null)
        {
            p = new UserTagProgress
            {
                UserId = userId, TagId = tagId,
                CompletedStepsMask = bit,
                LastStep = stepIndex,
                LastReviewedAt = now,
            };
            db.UserTagProgress.Add(p);
        }
        else
        {
            p.CompletedStepsMask |= bit;
            if (stepIndex > p.LastStep) p.LastStep = stepIndex;
            p.LastReviewedAt = now;
        }

        if (p.CompletedStepsMask == AllStepsMask && p.CompletedAt is null)
        {
            p.CompletedAt = now;
            await db.SaveChangesAsync();
            await BumpStreakAsync(userId);
        }
        else
        {
            await db.SaveChangesAsync();
        }
        return p;
    }

    public async Task<bool> IsWeekLockedAsync(Guid weekId, Guid userId)
    {
        var week = await db.Weeks.FirstOrDefaultAsync(w => w.Id == weekId);
        if (week is null) return true;
        if (week.Number <= 1) return false;

        var prev = await db.Weeks.FirstOrDefaultAsync(w => w.Number == week.Number - 1);
        if (prev is null) return false;
        var prevTagIds = await db.Tags.Where(t => t.WeekId == prev.Id).Select(t => t.Id).ToListAsync();
        if (prevTagIds.Count == 0) return false;
        var completed = await db.UserTagProgress
            .CountAsync(p => p.UserId == userId && prevTagIds.Contains(p.TagId) && p.CompletedStepsMask == AllStepsMask);
        return completed < prevTagIds.Count;
    }

    public async Task<Dictionary<Guid, bool>> GetWeekLockMapAsync(IEnumerable<Week> weeks, Guid userId)
    {
        var ordered = weeks.OrderBy(w => w.Number).ToList();
        var result = new Dictionary<Guid, bool>();
        var allTags = await db.Tags.Select(t => new { t.WeekId, t.Id }).ToListAsync();
        var allTagsByWeek = allTags.GroupBy(t => t.WeekId).ToDictionary(g => g.Key, g => g.Select(x => x.Id).ToList());

        var allProgress = await db.UserTagProgress
            .Where(p => p.UserId == userId && p.CompletedStepsMask == AllStepsMask)
            .Select(p => p.TagId)
            .ToListAsync();
        var completedSet = allProgress.ToHashSet();

        bool prevComplete = true;
        foreach (var w in ordered)
        {
            if (w.Number <= 1)
            {
                result[w.Id] = false;
            }
            else
            {
                result[w.Id] = !prevComplete;
            }
            var tagIds = allTagsByWeek.GetValueOrDefault(w.Id, []);
            prevComplete = tagIds.Count > 0 && tagIds.All(id => completedSet.Contains(id));
        }
        return result;
    }

    public async Task<GeneratedTagPassageResponse> GeneratePassageAsync(Guid tagId, GenerateTagPassageRequest req, Guid userId)
    {
        var tag = await db.Tags.Include(t => t.Week).FirstOrDefaultAsync(t => t.Id == tagId);
        if (tag is null) throw new InvalidOperationException("Tag not found");

        var set = await db.WordSets.Include(s => s.Words).FirstOrDefaultAsync(s => s.Id == req.WordSetId);
        if (set is null) throw new InvalidOperationException("WordSet not found");

        var words = set.Words.OrderBy(w => w.DisplayOrder).Select(w => w.Front).ToList();
        var level = string.IsNullOrWhiteSpace(req.Level) ? "A2" : req.Level!;
        var topic = $"daily life using these German words";

        var genReq = new DTOs.Requests.GenerateTextRequest(topic, level, 90, words);
        var generated = await ai.GenerateTextAsync(genReq, userId)
            ?? throw new InvalidOperationException("Text generation failed");

        var qs = await ai.GenerateQuestionsAsync(generated.Text, level, req.QuestionCount ?? 4, userId);

        return new GeneratedTagPassageResponse(
            Title: $"{tag.Name} — Lesetext",
            Content: generated.Text,
            Level: level,
            Questions: qs
        );
    }

    private async Task BumpStreakAsync(Guid userId)
    {
        var user = await db.Users.FirstOrDefaultAsync(u => u.Id == userId);
        if (user is null) return;
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        if (user.LastActivityDate == today) return;
        if (user.LastActivityDate == today.AddDays(-1)) user.CurrentStreak++;
        else user.CurrentStreak = 1;
        if (user.CurrentStreak > user.LongestStreak) user.LongestStreak = user.CurrentStreak;
        user.LastActivityDate = today;
        await db.SaveChangesAsync();
    }
}
