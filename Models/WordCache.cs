namespace Api.Models;

public class WordCache
{
    public Guid Id { get; set; }
    public string Word { get; set; } = string.Empty;
    public string PayloadJson { get; set; } = string.Empty;
    public DateTime CachedAt { get; set; } = DateTime.UtcNow;
}
