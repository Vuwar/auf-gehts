namespace Api.DTOs.Requests;

public record UpdateWordSetRequest(
    string? Name,
    string? Description,
    string? Level,
    bool? IsPublic,
    Guid? WeekId,
    bool? IsOfficial,
    bool ClearWeek = false
);
