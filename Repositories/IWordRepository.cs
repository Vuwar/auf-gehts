using Api.Models;

namespace Api.Repositories;

public interface IWordRepository
{
    Task<List<Word>> ListBySetAsync(Guid setId);
    Task<Word?> GetByIdAsync(Guid id);
    Task<Word> AddAsync(Word word);
    Task AddRangeAsync(IEnumerable<Word> words);
    Task DeleteAsync(Word word);
    Task SaveAsync();
}
