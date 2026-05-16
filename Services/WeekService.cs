using Api.Data;
using Api.DTOs.Responses;
using Api.Mappings;
using Api.Repositories;
using Microsoft.EntityFrameworkCore;

namespace Api.Services;

public class WeekService(
    IWeekRepository weeks,
    IProgressRepository progress,
    AppDbContext db)
{
    public async Task<List<WeekResponse>> ListAsync(Guid userId)
    {
        // 1 query: weeks
        var all = await weeks.GetAllAsync();

        // 1 query: all set IDs per week
        var setsByWeek = await db.WordSets
            .Where(s => s.WeekId != null)
            .Select(s => new { s.Id, WeekId = s.WeekId!.Value })
            .ToListAsync();

        // 1 query: user's progress statuses
        var statuses = await progress.GetStatusesForUserAsync(userId);

        var weekSetMap = setsByWeek
            .GroupBy(x => x.WeekId)
            .ToDictionary(g => g.Key, g => g.Select(x => x.Id).ToList());

        return all.Select(w =>
        {
            var setIds = weekSetMap.GetValueOrDefault(w.Id, []);
            var completed = setIds.Count(id => statuses.GetValueOrDefault(id) == Models.ProgressStatus.Completed);
            return new WeekResponse(w.Id, w.Number, w.Title, w.Description, setIds.Count, completed);
        }).ToList();
    }

    public async Task<WeekDetailResponse?> GetAsync(Guid id, Guid userId)
    {
        var week = await weeks.GetByIdAsync(id);
        if (week is null) return null;
        var sets = await db.WordSets
            .Include(s => s.Week)
            .Where(s => s.WeekId == id)
            .OrderBy(s => s.DisplayOrder)
            .ThenBy(s => s.CreatedAt)
            .Select(s => new { Set = s, WordCount = s.Words.Count })
            .ToListAsync();
        var statuses = await progress.GetStatusesForUserAsync(userId);

        var setResponses = sets.Select(r =>
            r.Set.ToResponse(userId, r.WordCount, statuses.GetValueOrDefault(r.Set.Id, Models.ProgressStatus.NotStarted))
        ).ToList();

        return new WeekDetailResponse(week.Id, week.Number, week.Title, week.Description, setResponses);
    }
}
