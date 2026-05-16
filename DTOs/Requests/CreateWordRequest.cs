namespace Api.DTOs.Requests;

public record CreateWordRequest(string Front, string Back, string? Context = null);
public record BulkAddWordsRequest(List<CreateWordRequest> Words);
