namespace Api.DTOs.Responses;

public record StatsResponse(
    int VocabCount,
    int ActiveSetCount,
    int CompletedSetCount,
    int WordsAddedThisWeek
);
