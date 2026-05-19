using Api.Data;
using Api.DTOs.Responses;
using Api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;

namespace Api.Services;

public class DashboardService(AppDbContext db, WordSetService sets, IMemoryCache cache)
{
    private const string WeeksCacheKey = "dashboard:weeks";
    private const string SetsByWeekCacheKey = "dashboard:setsByWeek";
    private static readonly TimeSpan SharedCacheTtl = TimeSpan.FromSeconds(60);

    public async Task<DashboardResponse> GetAsync(Guid userId)
    {
        var weekAgo = DateTime.UtcNow.AddDays(-7);

        var me = await db.Users
            .Where(u => u.Id == userId)
            .Select(u => new { u.CurrentStreak, u.LongestStreak })
            .FirstOrDefaultAsync();

        var vocab = await sets.EnsureVocabSetAsync(userId);

        var vocabCounts = await db.Words
            .Where(w => w.WordSetId == vocab.Id)
            .GroupBy(_ => 1)
            .Select(g => new VocabCounts(g.Count(), g.Count(w => w.CreatedAt >= weekAgo)))
            .FirstOrDefaultAsync() ?? new VocabCounts(0, 0);

        var progressCounts = await db.UserSetProgress
            .Where(p => p.UserId == userId)
            .GroupBy(_ => 1)
            .Select(g => new ProgressCounts(
                g.Count(p => p.Status == ProgressStatus.Active),
                g.Count(p => p.Status == ProgressStatus.Completed)))
            .FirstOrDefaultAsync() ?? new ProgressCounts(0, 0);

        var weeks = await GetWeeksCachedAsync();
        var setsByWeek = await GetSetsByWeekCachedAsync();

        var statusRows = await db.UserSetProgress
            .Where(p => p.UserId == userId)
            .Select(p => new { p.WordSetId, p.Status })
            .ToListAsync();
        var statuses = statusRows.ToDictionary(r => r.WordSetId, r => r.Status);

        var others = await db.Users
            .Where(u => u.Id != userId)
            .Select(u => new OtherUserRow(u.Id, u.DisplayName, u.CurrentStreak))
            .ToListAsync();

        var stats = new StatsResponse(
            vocabCounts.Total,
            progressCounts.Active,
            progressCounts.Completed,
            vocabCounts.ThisWeek
        );

        var weekSetMap = setsByWeek.GroupBy(x => x.WeekId).ToDictionary(g => g.Key, g => g.Select(x => x.Id).ToList());
        var weekResponses = weeks.Select(w =>
        {
            var setIds = weekSetMap.GetValueOrDefault(w.Id, []);
            var completed = setIds.Count(id => statuses.GetValueOrDefault(id) == ProgressStatus.Completed);
            return new WeekResponse(w.Id, w.Number, w.Title, w.Description, setIds.Count, completed);
        }).ToList();

        var currentWeek = weekResponses.FirstOrDefault(w => w.CompletedCount < w.SetCount) ?? weekResponses.LastOrDefault();
        var currentWeekSetIds = currentWeek is null ? new List<Guid>() : weekSetMap.GetValueOrDefault(currentWeek.Id, []);

        var friendIds = others.Select(o => o.Id).ToList();
        var friendCompletions = currentWeekSetIds.Count == 0 || friendIds.Count == 0
            ? new Dictionary<Guid, int>()
            : await db.UserSetProgress
                .Where(p => friendIds.Contains(p.UserId)
                         && currentWeekSetIds.Contains(p.WordSetId)
                         && p.Status == ProgressStatus.Completed)
                .GroupBy(p => p.UserId)
                .Select(g => new { UserId = g.Key, Count = g.Count() })
                .ToDictionaryAsync(x => x.UserId, x => x.Count);

        var friends = others.Select(o => new FriendProgressResponse(
            o.Id,
            o.DisplayName ?? "User",
            o.CurrentStreak,
            currentWeek?.Number,
            currentWeek?.Title,
            friendCompletions.GetValueOrDefault(o.Id, 0),
            currentWeek?.SetCount ?? 0
        )).ToList();

        return new DashboardResponse(
            stats,
            weekResponses,
            me?.CurrentStreak ?? 0,
            me?.LongestStreak ?? 0,
            friends
        );
    }

    private Task<List<Week>> GetWeeksCachedAsync() =>
        cache.GetOrCreateAsync(WeeksCacheKey, entry =>
        {
            entry.AbsoluteExpirationRelativeToNow = SharedCacheTtl;
            return db.Weeks.OrderBy(w => w.Number).ToListAsync();
        })!;

    private Task<List<SetWeekRow>> GetSetsByWeekCachedAsync() =>
        cache.GetOrCreateAsync(SetsByWeekCacheKey, entry =>
        {
            entry.AbsoluteExpirationRelativeToNow = SharedCacheTtl;
            return db.WordSets
                .Where(s => s.WeekId != null && s.IsOfficial && s.IsPublic)
                .Select(s => new SetWeekRow(s.Id, s.WeekId!.Value))
                .ToListAsync();
        })!;

    private record VocabCounts(int Total, int ThisWeek);
    private record ProgressCounts(int Active, int Completed);
    public record SetWeekRow(Guid Id, Guid WeekId);
    private record OtherUserRow(Guid Id, string? DisplayName, int CurrentStreak);
}
