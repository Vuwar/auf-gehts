namespace Api.DTOs.Requests;

public record CreateTagRequest(
    int TagNumber,
    string Name,
    Guid? WordSetId,
    Guid? ReadingTextId
);

public record UpdateTagRequest(
    int? TagNumber,
    string? Name,
    Guid? WordSetId,
    Guid? ReadingTextId,
    bool ClearWordSet = false,
    bool ClearReadingText = false
);

public record TagProgressUpdateRequest(int StepIndex);

public record GenerateTagPassageRequest(
    Guid WordSetId,
    string? Level,
    int? QuestionCount
);
