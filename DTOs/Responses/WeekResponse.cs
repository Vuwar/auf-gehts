namespace Api.DTOs.Responses;

public record WeekResponse(
    Guid Id,
    int Number,
    string Title,
    string? Description,
    int SetCount,
    int CompletedCount
);

public record WeekDetailResponse(
    Guid Id,
    int Number,
    string Title,
    string? Description,
    List<WordSetResponse> Sets
);
