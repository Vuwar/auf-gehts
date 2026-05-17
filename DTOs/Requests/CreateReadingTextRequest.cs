namespace Api.DTOs.Requests;

public record CreateReadingTextRequest(string Title, string Content, string? Level, bool IsPublic = true);
public record TranslateRequest(string Text);
