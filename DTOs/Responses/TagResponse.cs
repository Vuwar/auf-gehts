namespace Api.DTOs.Responses;

public record TagResponse(
    Guid Id,
    Guid WeekId,
    int TagNumber,
    string Name,
    Guid? WordSetId,
    string? WordSetName,
    int? WordCount,
    Guid? ReadingTextId,
    string? ReadingTextTitle,
    int QuestionCount,
    bool HasAudio,
    int CompletedStepsMask,
    int LastStep,
    bool IsCompleted
);

public record TagDetailResponse(
    Guid Id,
    Guid WeekId,
    int WeekNumber,
    string WeekTitle,
    int TagNumber,
    string Name,
    WordSetResponse? WordSet,
    List<WordResponse> Words,
    ReadingTextResponse? ReadingText,
    int CompletedStepsMask,
    int LastStep,
    bool IsCompleted,
    bool IsLocked
);

public record GeneratedTagPassageResponse(
    string Title,
    string Content,
    string Level,
    List<ReadingTextQuestionResponse> Questions
);
