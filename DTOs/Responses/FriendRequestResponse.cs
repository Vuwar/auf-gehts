namespace Api.DTOs.Responses;

public record FriendRequestResponse(
    Guid Id,
    Guid OtherUserId,
    string OtherUserDisplayName,
    DateTime CreatedAt
);

public record PendingRequestsResponse(
    List<FriendRequestResponse> Incoming,
    List<FriendRequestResponse> Outgoing
);

public record IncomingCountResponse(int Incoming);
