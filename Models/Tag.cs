namespace Api.Models;

public class Tag
{
    public Guid Id { get; set; }
    public Guid WeekId { get; set; }
    public int TagNumber { get; set; }
    public string Name { get; set; } = string.Empty;
    public Guid? WordSetId { get; set; }
    public Guid? ReadingTextId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public Week Week { get; set; } = null!;
    public WordSet? WordSet { get; set; }
    public ReadingText? ReadingText { get; set; }
}

public class UserTagProgress
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public Guid TagId { get; set; }
    public int CompletedStepsMask { get; set; }
    public int LastStep { get; set; }
    public DateTime? CompletedAt { get; set; }
    public DateTime LastReviewedAt { get; set; } = DateTime.UtcNow;

    public Tag Tag { get; set; } = null!;
}
