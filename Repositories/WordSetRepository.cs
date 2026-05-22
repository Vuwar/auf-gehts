using Api.Data;
using Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Api.Repositories;

public class WordSetRepository(AppDbContext db) : IWordSetRepository
{
    public async Task<List<(WordSet Set, int WordCount)>> ListPublicAsync()
    {
        var rows = await db.WordSets
            .Include(s => s.Week)
            .Include(s => s.CreatedByUser)
            .Where(s => s.IsPublic)
            .OrderByDescending(s => s.CreatedAt)
            .Select(s => new { Set = s, WordCount = s.Words.Count })
            .ToListAsync();
        return rows.Select(r => (r.Set, r.WordCount)).ToList();
    }

    public async Task<List<(WordSet Set, int WordCount)>> ListByOwnerAsync(Guid userId)
    {
        var rows = await db.WordSets
            .Include(s => s.Week)
            .Include(s => s.CreatedByUser)
            .Where(s => s.CreatedByUserId == userId)
            .OrderByDescending(s => s.CreatedAt)
            .Select(s => new { Set = s, WordCount = s.Words.Count })
            .ToListAsync();
        return rows.Select(r => (r.Set, r.WordCount)).ToList();
    }

    public Task<WordSet?> GetByIdAsync(Guid id) =>
        db.WordSets.Include(s => s.Week).Include(s => s.CreatedByUser).FirstOrDefaultAsync(s => s.Id == id);

    public Task<WordSet?> GetBySlugAsync(string slug) =>
        db.WordSets.Include(s => s.Week).Include(s => s.CreatedByUser).FirstOrDefaultAsync(s => s.Slug == slug);

    public Task<bool> SlugExistsAsync(string slug) =>
        db.WordSets.AnyAsync(s => s.Slug == slug);

    public Task<WordSet?> GetVocabSetForUserAsync(Guid userId) =>
        db.WordSets.FirstOrDefaultAsync(s =>
            s.CreatedByUserId == userId && !s.IsPublic && s.WeekId == null && s.Name == "My Vocabulary");

    public async Task<WordSet> AddAsync(WordSet set)
    {
        db.WordSets.Add(set);
        await db.SaveChangesAsync();
        return set;
    }

    public Task DeleteAsync(WordSet set)
    {
        db.WordSets.Remove(set);
        return db.SaveChangesAsync();
    }

    public Task SaveAsync() => db.SaveChangesAsync();
}
