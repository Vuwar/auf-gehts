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
    AppDbContext db)
{
    public async Task<List<WeekResponse>> ListAsync(Guid userId)
    {
        // 1 query: weeks
        var all = await weeks.GetAllAsync();

        // 1 query: all official set IDs per week
        var setsByWeek = await db.WordSets
            .Where(s => s.WeekId != null && s.IsOfficial && s.IsPublic)
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
            .Where(s => s.WeekId == id && s.IsOfficial && s.IsPublic)
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
}
