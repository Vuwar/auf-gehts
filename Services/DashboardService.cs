using Api.Data;
using Api.DTOs.Responses;
using Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Api.Services;

public class DashboardService(IServiceScopeFactory scopeFactory)
{
    public async Task<DashboardResponse> GetAsync(Guid userId)
    {
        var weekAgo = DateTime.UtcNow.AddDays(-7);

        // Phase 1: fan out the independent reads in parallel. Each task gets its own
        // scope (= own DbContext + own connection — EF can't run concurrent ops on a
        // single context). The connection pool naturally queues anything beyond the
        // configured Maximum Pool Size; wall-clock per request becomes roughly
        // max(query) rather than sum(query).
        var meTask = Scoped(d => d.Users
            .Where(u => u.Id == userId)
            .Select(u => new { u.CurrentStreak, u.LongestStreak })
            .FirstOrDefaultAsync());

        var vocabChainTask = ScopedAsync(async sp =>
        {
            var sets = sp.GetRequiredService<WordSetService>();
            var d = sp.GetRequiredService<AppDbContext>();
            var vocab = await sets.EnsureVocabSetAsync(userId);
            return await d.Words
                .Where(w => w.WordSetId == vocab.Id)
                .GroupBy(_ => 1)
                .Select(g => new VocabCounts(g.Count(), g.Count(w => w.CreatedAt >= weekAgo)))
                .FirstOrDefaultAsync() ?? new VocabCounts(0, 0);
        });

        var progressCountsTask = Scoped(async d =>
            await d.UserSetProgress
                .Where(p => p.UserId == userId)
                .GroupBy(_ => 1)
                .Select(g => new ProgressCounts(
                    g.Count(p => p.Status == ProgressStatus.Active),
                    g.Count(p => p.Status == ProgressStatus.Completed)))
                .FirstOrDefaultAsync() ?? new ProgressCounts(0, 0));

        var weeksTask = Scoped(d => d.Weeks.OrderBy(w => w.Number).ToListAsync());

        var setsByWeekTask = Scoped(d => d.WordSets
            .Where(s => s.WeekId != null && s.IsOfficial && s.IsPublic)
            .Select(s => new SetWeekRow(s.Id, s.WeekId!.Value))
            .ToListAsync());

        var statusesTask = Scoped(async d =>
        {
            var rows = await d.UserSetProgress
                .Where(p => p.UserId == userId)
                .Select(p => new { p.WordSetId, p.Status })
                .ToListAsync();
            return rows.ToDictionary(r => r.WordSetId, r => r.Status);
        });

        var othersTask = Scoped(d => d.Users
            .Where(u => u.Id != userId)
            .Select(u => new OtherUserRow(u.Id, u.DisplayName, u.Email, u.CurrentStreak))
            .ToListAsync());

        await Task.WhenAll(meTask, vocabChainTask, progressCountsTask, weeksTask, setsByWeekTask, statusesTask, othersTask);

        var me = await meTask;
        var vocabCounts = await vocabChainTask;
        var progressCounts = await progressCountsTask;
        var weeks = await weeksTask;
        var setsByWeek = await setsByWeekTask;
        var statuses = await statusesTask;
        var others = await othersTask;

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

        // Phase 2: friend completions depends on Phase 1 output.
        var friendIds = others.Select(o => o.Id).ToList();
        var friendCompletions = currentWeekSetIds.Count == 0 || friendIds.Count == 0
            ? new Dictionary<Guid, int>()
            : await Scoped(d => d.UserSetProgress
                .Where(p => friendIds.Contains(p.UserId)
                         && currentWeekSetIds.Contains(p.WordSetId)
                         && p.Status == ProgressStatus.Completed)
                .GroupBy(p => p.UserId)
                .Select(g => new { UserId = g.Key, Count = g.Count() })
                .ToDictionaryAsync(x => x.UserId, x => x.Count));

        var friends = others.Select(o => new FriendProgressResponse(
            o.Id,
            o.DisplayName ?? o.Email,
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

    private async Task<T> Scoped<T>(Func<AppDbContext, Task<T>> work)
    {
        using var scope = scopeFactory.CreateScope();
        var d = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        return await work(d);
    }

    private async Task<T> ScopedAsync<T>(Func<IServiceProvider, Task<T>> work)
    {
        using var scope = scopeFactory.CreateScope();
        return await work(scope.ServiceProvider);
    }

    private record VocabCounts(int Total, int ThisWeek);
    private record ProgressCounts(int Active, int Completed);
    private record SetWeekRow(Guid Id, Guid WeekId);
    private record OtherUserRow(Guid Id, string? DisplayName, string Email, int CurrentStreak);
}
