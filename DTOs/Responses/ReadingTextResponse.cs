namespace Api.DTOs.Responses;

public record ReadingTextResponse(
    Guid Id,
    string Title,
    string Content,
    string? Level,
    Guid? WeekId,
    int? WeekNumber,
    Guid? TagId,
    bool IsUnlocked,
    Guid? CreatedByUserId,
    string? CreatedByName,
    bool IsOwner,
    DateTime CreatedAt,
    string? AudioUrl,
    int? AudioDurationSec,
    string? AudioVoice,
    List<ReadingTextQuestionResponse> Questions
);

public record ReadingTextQuestionResponse(
    Guid Id,
    int DisplayOrder,
    string Type,
    string Prompt,
    List<string>? Options,
    string? CorrectAnswer
);

public record TranslateResponse(string Translation);

public record GeneratedQuestionsResponse(List<ReadingTextQuestionResponse> Questions);
