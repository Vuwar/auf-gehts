namespace Api.DTOs.Responses;

public record FriendSummaryResponse(
    Guid Id,
    string DisplayName,
    int CurrentStreak
);
