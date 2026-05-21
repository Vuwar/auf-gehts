using Api.DTOs.Responses;
using Api.Models;

namespace Api.Mappings;

public static class UserMapper
{
    public static UserResponse ToResponse(this User u)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        // Streak is alive only if the user was active today or yesterday.
        // Returning 0 here avoids showing a stale count after a missed day,
        // without needing a background reset job.
        var effectiveStreak = u.LastActivityDate.HasValue && u.LastActivityDate.Value >= today.AddDays(-1)
            ? u.CurrentStreak
            : 0;
        return new(
            u.Id, u.Email, u.DisplayName, u.Role.ToString(),
            effectiveStreak, u.LongestStreak,
            u.LastActivityDate?.ToString("yyyy-MM-dd"),
            !string.IsNullOrEmpty(u.AnthropicApiKey),
            u.CreatedAt, u.LastSeenAt
        );
    }
}
