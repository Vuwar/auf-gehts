namespace Api.DTOs.Responses;

public record WordResponse(
    Guid Id,
    Guid WordSetId,
    string Front,
    string Back,
    string? Context,
    int DisplayOrder,
    DateTime CreatedAt
);
