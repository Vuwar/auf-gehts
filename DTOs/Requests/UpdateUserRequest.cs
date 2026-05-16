namespace Api.DTOs.Requests;

public record UpdateUserRequest(string? DisplayName, string? AnthropicApiKey = null);
