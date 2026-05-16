namespace Api.Models;

public enum ProgressStatus
{
    NotStarted = 0,
    Active = 1,
    Completed = 2,
}

public class UserSetProgress
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public Guid WordSetId { get; set; }
    public ProgressStatus Status { get; set; } = ProgressStatus.NotStarted;
    public DateTime? StartedAt { get; set; }
    public DateTime? CompletedAt { get; set; }
    public DateTime LastReviewedAt { get; set; } = DateTime.UtcNow;

    public WordSet WordSet { get; set; } = null!;
}
