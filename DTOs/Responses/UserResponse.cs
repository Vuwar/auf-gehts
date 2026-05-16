namespace Api.DTOs.Responses;

public record UserResponse(
    Guid Id,
    string Email,
    string? DisplayName,
    string Role,
    bool HasAnthropicKey,
    DateTime CreatedAt,
    DateTime LastSeenAt
);
