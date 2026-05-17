namespace Api.DTOs.Responses;

public record FriendProgressResponse(
    Guid UserId,
    string DisplayName,
    int CurrentStreak,
    int? CurrentWeekNumber,
    string? CurrentWeekTitle,
    int CurrentWeekCompleted,
    int CurrentWeekTotal
);
