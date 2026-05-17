namespace Api.DTOs.Requests;

public record CreateReadingTextRequest(
    string Title,
    string Content,
    string? Level,
    Guid? WeekId,
    List<CreateReadingTextQuestion>? Questions
);

public record CreateReadingTextQuestion(
    string Type,
    string Prompt,
    List<string>? Options,
    string? CorrectAnswer
);

public record GenerateQuestionsRequest(string Content, string? Level, int Count = 4);

public record TranslateRequest(string Text);
