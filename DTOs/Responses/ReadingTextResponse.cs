namespace Api.DTOs.Responses;

public record ReadingTextResponse(
    Guid Id,
    string Title,
    string Content,
    string? Level,
    Guid? CreatedByUserId,
    string? CreatedByName,
    bool IsPublic,
    bool IsOwner,
    DateTime CreatedAt
);

public record TranslateResponse(string Translation);
