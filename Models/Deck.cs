namespace Api.Models;

public class Deck
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public List<FlashCard> FlashCards { get; set; } = [];
}
