namespace Api.Models;

public class Word
{
    public Guid Id { get; set; }
    public Guid WordSetId { get; set; }
    public string Front { get; set; } = string.Empty;
    public string Back { get; set; } = string.Empty;
    public string? Context { get; set; }
    public int DisplayOrder { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public WordSet WordSet { get; set; } = null!;
}
