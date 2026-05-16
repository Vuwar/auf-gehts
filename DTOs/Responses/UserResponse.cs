namespace Api.DTOs.Responses;

public record UserResponse(
    Guid Id,
    string Email,
    string? DisplayName,
    bool HasAnthropicKey,
    DateTime CreatedAt,
    DateTime LastSeenAt
);
