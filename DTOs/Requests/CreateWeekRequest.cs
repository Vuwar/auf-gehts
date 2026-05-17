namespace Api.DTOs.Requests;

public record CreateWeekRequest(int Number, string Title, string? Description);
public record UpdateWeekRequest(int? Number, string? Title, string? Description);
