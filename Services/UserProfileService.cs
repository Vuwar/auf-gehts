using Api.Data;
using Api.DTOs.Responses;
using Api.Models;
using Api.Repositories;
using Microsoft.EntityFrameworkCore;

namespace Api.Services;

public class UserProfileService(AppDbContext db, IFriendshipRepository friendships, FriendshipService friendship)
{
    private const string DisplayFallback = "User";
    private const int DefaultPageSize = 25;
    private const int MaxPageSize = 50;

    public async Task<UserProfileResponse?> GetProfileAsync(Guid viewerId, Guid targetId)
    {
        var user = await db.Users
            .Where(u => u.Id == targetId)
            .Select(u => new { u.Id, u.DisplayName, u.CurrentStreak, u.LongestStreak })
            .FirstOrDefaultAsync();
        if (user is null) return null;

        var row = viewerId == targetId
            ? null
            : await friendships.GetByPairAsync(viewerId, targetId);
        var state = friendship.ResolveState(viewerId, targetId, row);

        return new UserProfileResponse(
            user.Id,
            user.DisplayName ?? DisplayFallback,
            user.CurrentStreak,
            user.LongestStreak,
            state
        );
    }

    public async Task<UserDirectoryResponse> BrowseDirectoryAsync(Guid viewerId, string? q, int page, int pageSize)
    {
        if (page < 1) page = 1;
        if (pageSize < 1) pageSize = DefaultPageSize;
        if (pageSize > MaxPageSize) pageSize = MaxPageSize;

        var query = db.Users.AsNoTracking().Where(u => u.Id != viewerId);
        if (!string.IsNullOrWhiteSpace(q))
        {
            var needle = q.Trim().ToLower();
            query = query.Where(u =>
                (u.DisplayName != null && u.DisplayName.ToLower().Contains(needle)));
        }

        var total = await query.CountAsync();
        var rows = await query
            .OrderBy(u => u.DisplayName ?? "")
            .ThenBy(u => u.Id)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(u => new { u.Id, u.DisplayName })
            .ToListAsync();

        var ids = rows.Select(r => r.Id).ToList();
        var rels = await friendships.GetByPairsAsync(viewerId, ids);

        var items = rows.Select(r =>
        {
            rels.TryGetValue(r.Id, out var rel);
            var state = friendship.ResolveState(viewerId, r.Id, rel);
            return new UserDirectoryEntry(r.Id, r.DisplayName ?? DisplayFallback, state);
        }).ToList();

        return new UserDirectoryResponse(items, page, pageSize, total);
    }

    public async Task<List<FriendSummaryResponse>> ListFriendsAsync(Guid viewerId)
    {
        var ids = await friendships.GetAcceptedFriendIdsAsync(viewerId);
        if (ids.Count == 0) return new List<FriendSummaryResponse>();

        var rows = await db.Users
            .Where(u => ids.Contains(u.Id))
            .OrderBy(u => u.DisplayName ?? "")
            .Select(u => new FriendSummaryResponse(
                u.Id,
                u.DisplayName ?? DisplayFallback,
                u.CurrentStreak))
            .ToListAsync();
        return rows;
    }

    public async Task<PendingRequestsResponse> ListRequestsAsync(Guid viewerId)
    {
        var incoming = await friendships.GetIncomingPendingAsync(viewerId);
        var outgoing = await friendships.GetOutgoingPendingAsync(viewerId);

        var incomingDto = incoming.Select(f => new FriendRequestResponse(
            f.Id,
            f.RequesterId,
            f.Requester?.DisplayName ?? DisplayFallback,
            f.CreatedAt
        )).ToList();
        var outgoingDto = outgoing.Select(f => new FriendRequestResponse(
            f.Id,
            f.AddresseeId,
            f.Addressee?.DisplayName ?? DisplayFallback,
            f.CreatedAt
        )).ToList();
        return new PendingRequestsResponse(incomingDto, outgoingDto);
    }
}
