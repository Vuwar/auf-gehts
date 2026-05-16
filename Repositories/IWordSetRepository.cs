using Api.Models;

namespace Api.Repositories;

public interface IWordSetRepository
{
    Task<List<(WordSet Set, int WordCount)>> ListPublicAsync();
    Task<List<(WordSet Set, int WordCount)>> ListByOwnerAsync(Guid userId);
    Task<WordSet?> GetByIdAsync(Guid id);
    Task<WordSet?> GetBySlugAsync(string slug);
    Task<bool> SlugExistsAsync(string slug);
    Task<WordSet?> GetVocabSetForUserAsync(Guid userId);
    Task<WordSet> AddAsync(WordSet set);
    Task DeleteAsync(WordSet set);
    Task SaveAsync();
}
