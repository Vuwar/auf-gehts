namespace Api.DTOs.Responses;

public record WordDefinition(string PartOfSpeech, string Definition, List<string> Examples);

public record WordLookupResponse(
    string Word,
    string? Translation,
    string? Gender,
    string? Plural,
    List<WordDefinition> Definitions,
    List<string> Alternatives
);
