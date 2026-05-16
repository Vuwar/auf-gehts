namespace Api.Models;

public class AiUsage
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public DateOnly Date { get; set; }
    public int RequestCount { get; set; }
}
