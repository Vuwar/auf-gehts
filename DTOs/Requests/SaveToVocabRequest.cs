namespace Api.DTOs.Requests;

public record SaveToVocabRequest(string Front, string Back, string? Context = null);
