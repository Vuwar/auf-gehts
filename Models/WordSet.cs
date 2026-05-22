namespace Api.Models;

public class WordSet
{
    public Guid Id { get; set; }
    public string Slug { get; set; } = string.Empty;
    public Guid? WeekId { get; set; }
    public Guid? CreatedByUserId { get; set; }
    public bool IsPublic { get; set; }
    public bool IsOfficial { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? Level { get; set; }
    public int DisplayOrder { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public Week? Week { get; set; }
    public User? CreatedByUser { get; set; }
    public List<Word> Words { get; set; } = [];
}
