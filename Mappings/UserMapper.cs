using Api.DTOs.Responses;
using Api.Models;

namespace Api.Mappings;

public static class UserMapper
{
    public static UserResponse ToResponse(this User u) =>
        new(u.Id, u.Email, u.DisplayName, !string.IsNullOrEmpty(u.AnthropicApiKey), u.CreatedAt, u.LastSeenAt);
}
