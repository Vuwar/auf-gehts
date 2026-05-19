using Api.Services;

namespace Api.DTOs.Responses;

public record UserProfileResponse(
    Guid Id,
    string DisplayName,
    int CurrentStreak,
    int LongestStreak,
    FriendshipState FriendshipState
);
