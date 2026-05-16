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
    IProgressRepository progressRepo)
{
    public async Task<DashboardResponse> GetAsync(Guid userId)
    {
        var vocab = await setService.EnsureVocabSetAsync(userId);
        var weekAgo = DateTime.UtcNow.AddDays(-7);

        // 1 query: combined vocab counts via FILTER
        var vocabCounts = await db.Words
            .Where(w => w.WordSetId == vocab.Id)
            .GroupBy(_ => 1)
            .Select(g => new
            {
                Total = g.Count(),
                ThisWeek = g.Count(w => w.CreatedAt >= weekAgo)
            })
            .FirstOrDefaultAsync() ?? new { Total = 0, ThisWeek = 0 };

        // 1 query: progress counts via FILTER
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

        // Weeks with set counts and per-user completed counts (1 query for weeks, 1 for setsByWeek, 1 for statuses)
        var weeks = await weekRepo.GetAllAsync();
        var setsByWeek = await db.WordSets
            .Where(s => s.WeekId != null && s.IsOfficial)
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

        return new DashboardResponse(stats, weekResponses);
    }
}
