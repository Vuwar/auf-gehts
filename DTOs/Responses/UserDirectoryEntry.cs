using Api.Services;

namespace Api.DTOs.Responses;

public record UserDirectoryEntry(
    Guid Id,
    string DisplayName,
    FriendshipState FriendshipState
);

public record UserDirectoryResponse(
    List<UserDirectoryEntry> Items,
    int Page,
    int PageSize,
    int Total
);
