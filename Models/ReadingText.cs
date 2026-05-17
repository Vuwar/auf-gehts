namespace Api.Models;

public class ReadingText
{
    public Guid Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Content { get; set; } = string.Empty;
    public string? Level { get; set; }
    public Guid? WeekId { get; set; }
    public Week? Week { get; set; }
    public Guid? CreatedByUserId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public List<ReadingTextQuestion> Questions { get; set; } = [];
}

public enum ReadingQuestionType
{
    MultipleChoice = 0,
    TrueFalse = 1,
    ShortAnswer = 2,
    FreeText = 3,
}

public class ReadingTextQuestion
{
    public Guid Id { get; set; }
    public Guid ReadingTextId { get; set; }
    public int DisplayOrder { get; set; }
    public ReadingQuestionType Type { get; set; }
    public string Prompt { get; set; } = string.Empty;
    public string? OptionsJson { get; set; }
    public string? CorrectAnswer { get; set; }
}
