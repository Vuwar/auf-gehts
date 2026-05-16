namespace Api.DTOs.Requests;

public record CreateWordSetRequest(
    Guid? WeekId,
    string Name,
    string? Description,
    string? Level,
    bool IsPublic
);
