using Api.Data;
using Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Api.Repositories;

public class WordRepository(AppDbContext db) : IWordRepository
{
    public Task<List<Word>> ListBySetAsync(Guid setId) =>
        db.Words.Where(w => w.WordSetId == setId)
                .OrderBy(w => w.DisplayOrder)
                .ThenBy(w => w.CreatedAt)
                .ToListAsync();

    public Task<Word?> GetByIdAsync(Guid id) =>
        db.Words.FirstOrDefaultAsync(w => w.Id == id);

    public async Task<Word> AddAsync(Word word)
    {
        db.Words.Add(word);
        await db.SaveChangesAsync();
        return word;
    }

    public Task AddRangeAsync(IEnumerable<Word> words)
    {
        db.Words.AddRange(words);
        return db.SaveChangesAsync();
    }

    public Task DeleteAsync(Word word)
    {
        db.Words.Remove(word);
        return db.SaveChangesAsync();
    }

    public Task SaveAsync() => db.SaveChangesAsync();
}
