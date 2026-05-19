using Api.Data;
using Api.DTOs.Responses;
using Api.Models;
using Api.Repositories;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;

namespace Api.Services;

public class DashboardService(AppDbContext db, IFriendshipRepository friendships, IMemoryCache cache)
{
    private const string DisplayFallback = "User";
    private const string WeeksCacheKey = "dashboard:weeks";
    private const string SetsByWeekCacheKey = "dashboard:setsByWeek";
    private static readonly TimeSpan SharedCacheTtl = TimeSpan.FromSeconds(60);

    public async Task<DashboardResponse> GetAsync(Guid userId, Guid weekId)
    {
        var friendIds = await friendships.GetAcceptedFriendIdsAsync(userId);
        if (friendIds.Count == 0)
            return new DashboardResponse(new List<FriendProgressResponse>());

        var setsByWeek = await GetSetsByWeekCachedAsync();
        var currentWeekSetIds = setsByWeek
            .Where(s => s.WeekId == weekId)
            .Select(s => s.Id)
            .ToList();

        var weeks = await GetWeeksCachedAsync();
        var weekMeta = weeks.FirstOrDefault(w => w.Id == weekId);

        Dictionary<Guid, int> friendCompletions;
        if (currentWeekSetIds.Count == 0)
        {
            friendCompletions = new Dictionary<Guid, int>();
        }
        else
        {
            friendCompletions = await db.UserSetProgress
                .Where(p => friendIds.Contains(p.UserId)
                         && currentWeekSetIds.Contains(p.WordSetId)
                         && p.Status == ProgressStatus.Completed)
                .GroupBy(p => p.UserId)
                .Select(g => new { UserId = g.Key, Count = g.Count() })
                .ToDictionaryAsync(x => x.UserId, x => x.Count);
        }

        var friendUsers = await db.Users
            .Where(u => friendIds.Contains(u.Id))
            .Select(u => new { u.Id, u.DisplayName, u.CurrentStreak })
            .ToListAsync();

        var friends = friendUsers
            .OrderBy(u => u.DisplayName ?? "")
            .Select(u => new FriendProgressResponse(
                u.Id,
                u.DisplayName ?? DisplayFallback,
                u.CurrentStreak,
                weekMeta?.Number,
                weekMeta?.Title,
                friendCompletions.GetValueOrDefault(u.Id, 0),
                currentWeekSetIds.Count
            ))
            .ToList();

        return new DashboardResponse(friends);
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

    public record SetWeekRow(Guid Id, Guid WeekId);
}
