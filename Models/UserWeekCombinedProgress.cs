namespace Api.Models;

public class UserWeekCombinedProgress
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public Guid WeekId { get; set; }
    public ProgressStatus Status { get; set; } = ProgressStatus.NotStarted;
    public DateTime? StartedAt { get; set; }
    public DateTime? CompletedAt { get; set; }
    public DateTime LastReviewedAt { get; set; } = DateTime.UtcNow;

    public Week Week { get; set; } = null!;
}
