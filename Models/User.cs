namespace Api.Models;

public enum UserRole
{
    Admin = 0,
    Default = 1,
    ViewOnly = 2,
}

public class User
{
    public Guid Id { get; set; }
    public string Email { get; set; } = string.Empty;
    public string? DisplayName { get; set; }
    public string? AnthropicApiKey { get; set; }
    public UserRole Role { get; set; } = UserRole.Default;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime LastSeenAt { get; set; } = DateTime.UtcNow;
}
