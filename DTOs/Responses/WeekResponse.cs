namespace Api.DTOs.Responses;

public record WeekResponse(
    Guid Id,
    int Number,
    string Title,
    string? Description,
    int SetCount,
    int CompletedCount,
    int TagCount,
    int CompletedTagCount,
    bool IsLocked
);

public record WeekDetailResponse(
    Guid Id,
    int Number,
    string Title,
    string? Description,
    List<WordSetResponse> Sets,
    List<ReadingTextSummaryResponse> ReadingTexts,
    List<TagResponse> Tags,
    bool IsLocked
);

public record ReadingTextSummaryResponse(
    Guid Id,
    string Title,
    string? Level,
    int QuestionCount,
    int CharCount
);
