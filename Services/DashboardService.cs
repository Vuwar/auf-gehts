using Api.Data;
using Api.DTOs.Responses;
using Api.Models;
using Api.Repositories;
using Microsoft.EntityFrameworkCore;

namespace Api.Services;

public class DashboardService(
    AppDbContext db,
    WordSetService setService,
    IWeekRepository weekRepo,
    IProgressRepository progressRepo,
    IUserRepository userRepo)
{
    public async Task<DashboardResponse> GetAsync(Guid userId)
    {
        var me = await userRepo.GetByIdAsync(userId);
        var vocab = await setService.EnsureVocabSetAsync(userId);
        var weekAgo = DateTime.UtcNow.AddDays(-7);

        var vocabCounts = await db.Words
            .Where(w => w.WordSetId == vocab.Id)
            .GroupBy(_ => 1)
            .Select(g => new
            {
                Total = g.Count(),
                ThisWeek = g.Count(w => w.CreatedAt >= weekAgo)
            })
            .FirstOrDefaultAsync() ?? new { Total = 0, ThisWeek = 0 };

        var progressCounts = await db.UserSetProgress
            .Where(p => p.UserId == userId)
            .GroupBy(_ => 1)
            .Select(g => new
            {
                Active = g.Count(p => p.Status == ProgressStatus.Active),
                Completed = g.Count(p => p.Status == ProgressStatus.Completed)
            })
            .FirstOrDefaultAsync() ?? new { Active = 0, Completed = 0 };

        var stats = new StatsResponse(
            vocabCounts.Total,
            progressCounts.Active,
            progressCounts.Completed,
            vocabCounts.ThisWeek
        );

        var weeks = await weekRepo.GetAllAsync();
        var setsByWeek = await db.WordSets
            .Where(s => s.WeekId != null && s.IsOfficial && s.IsPublic)
            .Select(s => new { s.Id, WeekId = s.WeekId!.Value })
            .ToListAsync();
        var statuses = await progressRepo.GetStatusesForUserAsync(userId);

        var weekSetMap = setsByWeek.GroupBy(x => x.WeekId).ToDictionary(g => g.Key, g => g.Select(x => x.Id).ToList());
        var weekResponses = weeks.Select(w =>
        {
            var setIds = weekSetMap.GetValueOrDefault(w.Id, []);
            var completed = setIds.Count(id => statuses.GetValueOrDefault(id) == ProgressStatus.Completed);
            return new WeekResponse(w.Id, w.Number, w.Title, w.Description, setIds.Count, completed);
        }).ToList();

        // Friends: all other users + current week progress
        var currentWeek = weekResponses.FirstOrDefault(w => w.CompletedCount < w.SetCount) ?? weekResponses.LastOrDefault();
        var currentWeekSetIds = currentWeek is null ? new List<Guid>() : weekSetMap.GetValueOrDefault(currentWeek.Id, []);

        var others = await db.Users
            .Where(u => u.Id != userId)
            .Select(u => new { u.Id, u.DisplayName, u.Email, u.CurrentStreak })
            .ToListAsync();

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
}
