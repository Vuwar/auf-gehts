namespace Api.DTOs.Responses;

public record UserResponse(
    Guid Id,
    string Email,
    string? DisplayName,
    string Role,
    int CurrentStreak,
    int LongestStreak,
    string? LastActivityDate,
    bool HasAnthropicKey,
    DateTime CreatedAt,
    DateTime LastSeenAt
);
