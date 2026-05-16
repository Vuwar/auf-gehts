namespace Api.DTOs.Responses;

public record WordSetResponse(
    Guid Id,
    string Slug,
    Guid? WeekId,
    int? WeekNumber,
    string Name,
    string? Description,
    string? Level,
    bool IsPublic,
    bool IsOfficial,
    bool IsOwner,
    int WordCount,
    string ProgressStatus,
    DateTime CreatedAt
);
