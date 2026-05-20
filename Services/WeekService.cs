using Api.Data;
using Api.DTOs.Requests;
using Api.DTOs.Responses;
using Api.Mappings;
using Api.Models;
using Api.Repositories;
using Microsoft.EntityFrameworkCore;

namespace Api.Services;

public class WeekService(
    IWeekRepository weeks,
    IProgressRepository progress,
    CurrentUserAccessor currentUser,
    TagService tagService,
    AppDbContext db)
{
    public async Task<List<WeekResponse>> ListAsync(Guid userId)
    {
        var all = await weeks.GetAllAsync();

        var setsByWeek = await db.WordSets
            .Where(s => s.WeekId != null && s.IsOfficial && s.IsPublic)
            .Select(s => new { s.Id, WeekId = s.WeekId!.Value })
            .ToListAsync();

        var statuses = await progress.GetStatusesForUserAsync(userId);

        var weekSetMap = setsByWeek
            .GroupBy(x => x.WeekId)
            .ToDictionary(g => g.Key, g => g.Select(x => x.Id).ToList());

        var tagRows = await db.Tags.Select(t => new { t.Id, t.WeekId }).ToListAsync();
        var tagsByWeek = tagRows.GroupBy(t => t.WeekId).ToDictionary(g => g.Key, g => g.Select(x => x.Id).ToList());

        var completedTagIds = await db.UserTagProgress
            .Where(p => p.UserId == userId && p.CompletedStepsMask == TagService.AllStepsMask)
            .Select(p => p.TagId)
            .ToListAsync();
        var completedTagSet = completedTagIds.ToHashSet();

        var lockMap = await tagService.GetWeekLockMapAsync(all, userId);

        return all.Select(w =>
        {
            var setIds = weekSetMap.GetValueOrDefault(w.Id, []);
            var completed = setIds.Count(id => statuses.GetValueOrDefault(id) == Models.ProgressStatus.Completed);
            var tagIds = tagsByWeek.GetValueOrDefault(w.Id, []);
            var completedTags = tagIds.Count(id => completedTagSet.Contains(id));
            return new WeekResponse(w.Id, w.Number, w.Title, w.Description, setIds.Count, completed, tagIds.Count, completedTags, lockMap.GetValueOrDefault(w.Id, false));
        }).ToList();
    }

    public async Task<WeekDetailResponse?> GetAsync(Guid id, Guid userId)
    {
        var week = await weeks.GetByIdAsync(id);
        if (week is null) return null;
        var sets = await db.WordSets
            .Include(s => s.Week)
            .Where(s => s.WeekId == id && s.IsOfficial && s.IsPublic)
            .OrderBy(s => s.DisplayOrder)
            .ThenBy(s => s.CreatedAt)
            .Select(s => new { Set = s, WordCount = s.Words.Count })
            .ToListAsync();
        var statuses = await progress.GetStatusesForUserAsync(userId);

        var setResponses = sets.Select(r =>
            r.Set.ToResponse(userId, r.WordCount, statuses.GetValueOrDefault(r.Set.Id, Models.ProgressStatus.NotStarted))
        ).ToList();

        var texts = await db.ReadingTexts
            .Where(t => t.WeekId == id)
            .OrderByDescending(t => t.CreatedAt)
            .Select(t => new ReadingTextSummaryResponse(t.Id, t.Title, t.Level, t.Questions.Count, t.Content.Length))
            .ToListAsync();

        var tags = await tagService.ListAsync(id, userId);
        var locked = await tagService.IsWeekLockedAsync(id, userId);

        return new WeekDetailResponse(week.Id, week.Number, week.Title, week.Description, setResponses, texts, tags, locked);
    }

    public async Task<(Week? week, string? error)> CreateAsync(CreateWeekRequest req)
    {
        var user = await currentUser.GetAsync();
        if (user?.Role != UserRole.Admin) return (null, "Admin only");
        if (string.IsNullOrWhiteSpace(req.Title)) return (null, "Title required");
        var existing = await weeks.GetByNumberAsync(req.Number);
        if (existing is not null) return (null, $"Week {req.Number} already exists");
        var week = await weeks.AddAsync(new Week { Number = req.Number, Title = req.Title.Trim(), Description = req.Description });
        return (week, null);
    }

    public async Task<(Week? week, string? error)> UpdateAsync(Guid id, UpdateWeekRequest req)
    {
        var user = await currentUser.GetAsync();
        if (user?.Role != UserRole.Admin) return (null, "Admin only");
        var week = await weeks.GetByIdAsync(id);
        if (week is null) return (null, "Not found");
        if (req.Number.HasValue && req.Number.Value != week.Number)
        {
            var other = await weeks.GetByNumberAsync(req.Number.Value);
            if (other is not null) return (null, $"Week {req.Number.Value} already exists");
            week.Number = req.Number.Value;
        }
        if (req.Title is not null && req.Title.Trim().Length > 0) week.Title = req.Title.Trim();
        if (req.Description is not null) week.Description = req.Description;
        await weeks.SaveAsync();
        return (week, null);
    }

    public async Task<bool> DeleteAsync(Guid id)
    {
        var user = await currentUser.GetAsync();
        if (user?.Role != UserRole.Admin) return false;
        var week = await weeks.GetByIdAsync(id);
        if (week is null) return false;
        await weeks.DeleteAsync(week);
        return true;
    }

    // Synthetic id derived deterministically from a week id so the client has a stable identifier.
    private static Guid SyntheticSetId(Guid weekId)
    {
        var bytes = weekId.ToByteArray();
        // Flip a couple of bytes so it never collides with a real WordSet id.
        bytes[6] = (byte)(bytes[6] ^ 0xCB);
        bytes[7] = (byte)(bytes[7] ^ 0xAF);
        return new Guid(bytes);
    }

    public async Task<WordSetResponse?> GetCombinedSetAsync(Guid weekId, Guid userId)
    {
        var week = await weeks.GetByIdAsync(weekId);
        if (week is null) return null;

        var wordCount = await db.WordSets
            .Where(s => s.WeekId == weekId && s.IsOfficial && s.IsPublic)
            .SelectMany(s => s.Words.Select(w => new { Front = w.Front.ToLower(), Back = w.Back.ToLower() }))
            .Distinct()
            .CountAsync();

        var prog = await db.UserWeekCombinedProgress
            .FirstOrDefaultAsync(p => p.UserId == userId && p.WeekId == weekId);
        var status = prog?.Status ?? ProgressStatus.NotStarted;

        return new WordSetResponse(
            SyntheticSetId(weekId),
            $"weekly:{week.Number}",
            weekId,
            week.Number,
            $"Woche {week.Number} — All Words",
            week.Description,
            null,
            false,
            true,
            false,
            false,
            wordCount,
            status.ToString(),
            week.CreatedAt
        );
    }

    public async Task<List<WordResponse>> GetCombinedWordsAsync(Guid weekId)
    {
        // Union of words across all official sets in the week, deduped case-insensitively by (front, back).
        var rows = await db.WordSets
            .Where(s => s.WeekId == weekId && s.IsOfficial && s.IsPublic)
            .SelectMany(s => s.Words)
            .OrderBy(w => w.DisplayOrder)
            .ThenBy(w => w.CreatedAt)
            .Select(w => new WordResponse(w.Id, w.WordSetId, w.Front, w.Back, w.Context, w.DisplayOrder, w.CreatedAt))
            .ToListAsync();

        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var deduped = new List<WordResponse>(rows.Count);
        foreach (var r in rows)
        {
            var key = r.Front + "" + r.Back;
            if (seen.Add(key)) deduped.Add(r);
        }
        return deduped;
    }

    public async Task SetCombinedProgressAsync(Guid weekId, Guid userId, ProgressStatus status)
    {
        var existing = await db.UserWeekCombinedProgress
            .FirstOrDefaultAsync(p => p.UserId == userId && p.WeekId == weekId);
        var now = DateTime.UtcNow;
        if (existing is null)
        {
            db.UserWeekCombinedProgress.Add(new UserWeekCombinedProgress
            {
                UserId = userId,
                WeekId = weekId,
                Status = status,
                StartedAt = status == ProgressStatus.Active ? now : null,
                CompletedAt = status == ProgressStatus.Completed ? now : null,
                LastReviewedAt = now,
            });
        }
        else
        {
            existing.Status = status;
            if (status == ProgressStatus.Active && existing.StartedAt is null) existing.StartedAt = now;
            if (status == ProgressStatus.Completed) existing.CompletedAt = now;
            existing.LastReviewedAt = now;
        }
        await db.SaveChangesAsync();
    }
}
