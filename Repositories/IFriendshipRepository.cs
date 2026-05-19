using Api.Models;

namespace Api.Repositories;

public interface IFriendshipRepository
{
    Task<List<Guid>> GetAcceptedFriendIdsAsync(Guid userId);
    Task<Friendship?> GetByPairAsync(Guid a, Guid b);
    Task<Friendship?> GetByIdAsync(Guid id);
    Task<List<Friendship>> GetIncomingPendingAsync(Guid userId);
    Task<List<Friendship>> GetOutgoingPendingAsync(Guid userId);
    Task<int> CountIncomingPendingAsync(Guid userId);
    Task<Dictionary<Guid, Friendship>> GetByPairsAsync(Guid viewerId, IEnumerable<Guid> otherIds);
    Task<Friendship> AddAsync(Friendship friendship);
    Task RemoveAsync(Friendship friendship);
    Task SaveAsync();
}
