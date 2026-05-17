namespace Api.Models;

public class AiUsage
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public DateOnly Date { get; set; }
    public int GenerateCount { get; set; }
    public int TranslateCount { get; set; }
}
