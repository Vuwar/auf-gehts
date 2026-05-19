using Api.Models;
using Api.Repositories;

namespace Api.Services;

public enum FriendshipState
{
    Self,
    None,
    PendingOutgoing,
    PendingIncoming,
    Friends,
    Declined,
}

public enum FriendRequestOutcome
{
    Created,
    ResubmittedAfterDecline,
    AutoAcceptedFromReverse,
    AlreadyPending,
    AlreadyFriends,
    SelfRejected,
    AddresseeMissing,
}

public record FriendRequestResult(FriendRequestOutcome Outcome, Friendship? Friendship);

public enum FriendActionOutcome
{
    Ok,
    NotFound,
    NotAuthorized,
    NotPending,
}

public class FriendshipService(IFriendshipRepository friendships, IUserRepository users)
{
    public async Task<FriendRequestResult> SendRequestAsync(Guid requesterId, Guid addresseeId)
    {
        if (requesterId == addresseeId)
            return new FriendRequestResult(FriendRequestOutcome.SelfRejected, null);

        var addressee = await users.GetByIdAsync(addresseeId);
        if (addressee is null)
            return new FriendRequestResult(FriendRequestOutcome.AddresseeMissing, null);

        var existing = await friendships.GetByPairAsync(requesterId, addresseeId);
        if (existing is not null)
        {
            if (existing.Status == FriendshipStatus.Accepted)
                return new FriendRequestResult(FriendRequestOutcome.AlreadyFriends, existing);

            if (existing.Status == FriendshipStatus.Pending)
            {
                if (existing.RequesterId == requesterId)
                    return new FriendRequestResult(FriendRequestOutcome.AlreadyPending, existing);

                existing.Status = FriendshipStatus.Accepted;
                existing.RespondedAt = DateTime.UtcNow;
                await friendships.SaveAsync();
                return new FriendRequestResult(FriendRequestOutcome.AutoAcceptedFromReverse, existing);
            }

            existing.Status = FriendshipStatus.Pending;
            existing.RespondedAt = null;
            existing.CreatedAt = DateTime.UtcNow;
            existing.RequesterId = requesterId;
            existing.AddresseeId = addresseeId;
            await friendships.SaveAsync();
            return new FriendRequestResult(FriendRequestOutcome.ResubmittedAfterDecline, existing);
        }

        var created = await friendships.AddAsync(new Friendship
        {
            RequesterId = requesterId,
            AddresseeId = addresseeId,
            Status = FriendshipStatus.Pending,
        });
        return new FriendRequestResult(FriendRequestOutcome.Created, created);
    }

    public async Task<FriendActionOutcome> AcceptAsync(Guid requestId, Guid viewerId)
    {
        var row = await friendships.GetByIdAsync(requestId);
        if (row is null) return FriendActionOutcome.NotFound;
        if (row.AddresseeId != viewerId) return FriendActionOutcome.NotAuthorized;
        if (row.Status != FriendshipStatus.Pending) return FriendActionOutcome.NotPending;
        row.Status = FriendshipStatus.Accepted;
        row.RespondedAt = DateTime.UtcNow;
        await friendships.SaveAsync();
        return FriendActionOutcome.Ok;
    }

    public async Task<FriendActionOutcome> DeclineAsync(Guid requestId, Guid viewerId)
    {
        var row = await friendships.GetByIdAsync(requestId);
        if (row is null) return FriendActionOutcome.NotFound;
        if (row.AddresseeId != viewerId) return FriendActionOutcome.NotAuthorized;
        if (row.Status != FriendshipStatus.Pending) return FriendActionOutcome.NotPending;
        row.Status = FriendshipStatus.Declined;
        row.RespondedAt = DateTime.UtcNow;
        await friendships.SaveAsync();
        return FriendActionOutcome.Ok;
    }

    public async Task<FriendActionOutcome> CancelAsync(Guid requestId, Guid viewerId)
    {
        var row = await friendships.GetByIdAsync(requestId);
        if (row is null) return FriendActionOutcome.NotFound;
        if (row.RequesterId != viewerId) return FriendActionOutcome.NotAuthorized;
        if (row.Status != FriendshipStatus.Pending) return FriendActionOutcome.NotPending;
        await friendships.RemoveAsync(row);
        return FriendActionOutcome.Ok;
    }

    public async Task<bool> UnfriendAsync(Guid viewerId, Guid otherId)
    {
        var row = await friendships.GetByPairAsync(viewerId, otherId);
        if (row is null || row.Status != FriendshipStatus.Accepted) return false;
        await friendships.RemoveAsync(row);
        return true;
    }

    public FriendshipState ResolveState(Guid viewerId, Guid otherId, Friendship? row)
    {
        if (viewerId == otherId) return FriendshipState.Self;
        if (row is null) return FriendshipState.None;
        return row.Status switch
        {
            FriendshipStatus.Accepted => FriendshipState.Friends,
            FriendshipStatus.Declined => FriendshipState.Declined,
            FriendshipStatus.Pending when row.RequesterId == viewerId => FriendshipState.PendingOutgoing,
            FriendshipStatus.Pending => FriendshipState.PendingIncoming,
            _ => FriendshipState.None,
        };
    }

    public async Task<FriendshipState> GetStateAsync(Guid viewerId, Guid otherId)
    {
        if (viewerId == otherId) return FriendshipState.Self;
        var row = await friendships.GetByPairAsync(viewerId, otherId);
        return ResolveState(viewerId, otherId, row);
    }
}
