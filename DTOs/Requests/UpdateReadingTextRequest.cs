namespace Api.DTOs.Requests;

public record UpdateReadingTextRequest(
    string? Title,
    string? Content,
    string? Level,
    Guid? WeekId,
    bool ClearWeek = false,
    List<CreateReadingTextQuestion>? Questions = null
);
