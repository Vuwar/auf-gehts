using Api.Data;
using Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Api.Repositories;

public class FriendshipRepository(AppDbContext db) : IFriendshipRepository
{
    public async Task<List<Guid>> GetAcceptedFriendIdsAsync(Guid userId)
    {
        return await db.Friendships
            .Where(f => f.Status == FriendshipStatus.Accepted
                     && (f.RequesterId == userId || f.AddresseeId == userId))
            .Select(f => f.RequesterId == userId ? f.AddresseeId : f.RequesterId)
            .ToListAsync();
    }

    public Task<Friendship?> GetByPairAsync(Guid a, Guid b) =>
        db.Friendships.FirstOrDefaultAsync(f =>
            (f.RequesterId == a && f.AddresseeId == b)
         || (f.RequesterId == b && f.AddresseeId == a));

    public Task<Friendship?> GetByIdAsync(Guid id) =>
        db.Friendships.FirstOrDefaultAsync(f => f.Id == id);

    public Task<List<Friendship>> GetIncomingPendingAsync(Guid userId) =>
        db.Friendships
            .Include(f => f.Requester)
            .Where(f => f.AddresseeId == userId && f.Status == FriendshipStatus.Pending)
            .OrderByDescending(f => f.CreatedAt)
            .ToListAsync();

    public Task<List<Friendship>> GetOutgoingPendingAsync(Guid userId) =>
        db.Friendships
            .Include(f => f.Addressee)
            .Where(f => f.RequesterId == userId && f.Status == FriendshipStatus.Pending)
            .OrderByDescending(f => f.CreatedAt)
            .ToListAsync();

    public Task<int> CountIncomingPendingAsync(Guid userId) =>
        db.Friendships.CountAsync(f =>
            f.AddresseeId == userId && f.Status == FriendshipStatus.Pending);

    public async Task<Dictionary<Guid, Friendship>> GetByPairsAsync(Guid viewerId, IEnumerable<Guid> otherIds)
    {
        var ids = otherIds.ToList();
        if (ids.Count == 0) return new Dictionary<Guid, Friendship>();
        var rows = await db.Friendships
            .Where(f =>
                (f.RequesterId == viewerId && ids.Contains(f.AddresseeId))
             || (f.AddresseeId == viewerId && ids.Contains(f.RequesterId)))
            .ToListAsync();
        return rows.ToDictionary(f => f.RequesterId == viewerId ? f.AddresseeId : f.RequesterId);
    }

    public async Task<Friendship> AddAsync(Friendship friendship)
    {
        db.Friendships.Add(friendship);
        await db.SaveChangesAsync();
        return friendship;
    }

    public Task RemoveAsync(Friendship friendship)
    {
        db.Friendships.Remove(friendship);
        return db.SaveChangesAsync();
    }

    public Task SaveAsync() => db.SaveChangesAsync();
}
