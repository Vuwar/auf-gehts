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
    List<WordSetResponse> Sets,
    List<ReadingTextSummaryResponse> ReadingTexts
);

public record ReadingTextSummaryResponse(
    Guid Id,
    string Title,
    string? Level,
    int QuestionCount,
    int CharCount
);
