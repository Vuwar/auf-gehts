namespace Api.Models;

public class Week
{
    public Guid Id { get; set; }
    public int Number { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public List<WordSet> WordSets { get; set; } = [];
    public List<ReadingText> ReadingTexts { get; set; } = [];
}
