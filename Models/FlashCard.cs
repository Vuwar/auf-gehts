namespace Api.Models;

public class FlashCard
{
    public Guid Id { get; set; }
    public Guid DeckId { get; set; }
    public string Front { get; set; } = string.Empty;
    public string Back { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public Deck Deck { get; set; } = null!;
}
