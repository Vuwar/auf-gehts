namespace Api.DTOs.Requests;

public record GenerateTextRequest(
    string Topic,
    string Level,
    int? WordCount = null,
    List<string>? WordsToInclude = null
);
