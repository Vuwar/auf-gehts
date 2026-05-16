namespace Api.DTOs.Requests;

public record UpdateWordSetRequest(
    string? Name,
    string? Description,
    string? Level,
    bool? IsPublic
);
