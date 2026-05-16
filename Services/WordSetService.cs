using Api.Data;
using Api.DTOs.Requests;
using Api.DTOs.Responses;
using Api.Mappings;
using Api.Models;
using Api.Repositories;
using Api.Utils;
using Microsoft.EntityFrameworkCore;

namespace Api.Services;

public class WordSetService(
    IWordSetRepository sets,
    IProgressRepository progress,
    AppDbContext db)
{
    public async Task<LibraryResponse> ListForLibraryAsync(Guid userId)
    {
        // 1 query: all user progress with sets + weeks
        var userProgress = await db.UserSetProgress
            .Include(p => p.WordSet).ThenInclude(s => s.Week)
            .Where(p => p.UserId == userId)
            .OrderByDescending(p => p.LastReviewedAt)
            .ToListAsync();

        // 1 query: all owned sets with weeks + word counts via subquery
        var ownedRaw = await db.WordSets
            .Include(s => s.Week)
            .Where(s => s.OwnerUserId == userId)
            .OrderByDescending(s => s.CreatedAt)
            .Select(s => new { Set = s, WordCount = s.Words.Count })
            .ToListAsync();

        // 1 query: all word counts for sets in progress
        var progressSetIds = userProgress.Select(p => p.WordSetId).ToList();
        var progressCounts = progressSetIds.Count == 0
            ? new Dictionary<Guid, int>()
            : await db.Words
                .Where(w => progressSetIds.Contains(w.WordSetId))
                .GroupBy(w => w.WordSetId)
                .Select(g => new { Id = g.Key, Count = g.Count() })
                .ToDictionaryAsync(x => x.Id, x => x.Count);

        var active = userProgress.Where(p => p.Status == ProgressStatus.Active)
            .Select(p => p.WordSet.ToResponse(userId, progressCounts.GetValueOrDefault(p.WordSetId, 0), p.Status))
            .ToList();

        var completed = userProgress.Where(p => p.Status == ProgressStatus.Completed)
            .Select(p => p.WordSet.ToResponse(userId, progressCounts.GetValueOrDefault(p.WordSetId, 0), p.Status))
            .ToList();

        var progressMap = userProgress.ToDictionary(p => p.WordSetId, p => p.Status);
        var mine = ownedRaw.Select(r => r.Set.ToResponse(userId, r.WordCount,
            progressMap.GetValueOrDefault(r.Set.Id, ProgressStatus.NotStarted)
        )).ToList();

        return new LibraryResponse(active, completed, mine);
    }

    public async Task<WordSetResponse?> GetAsync(Guid id, Guid userId)
    {
        var set = await sets.GetByIdAsync(id);
        return await BuildResponse(set, userId);
    }

    public async Task<WordSetResponse?> GetBySlugAsync(string slug, Guid userId)
    {
        var set = await sets.GetBySlugAsync(slug);
        return await BuildResponse(set, userId);
    }

    public async Task<WordSet?> ResolveAsync(string idOrSlug, Guid userId)
    {
        WordSet? set = Guid.TryParse(idOrSlug, out var id)
            ? await sets.GetByIdAsync(id)
            : await sets.GetBySlugAsync(idOrSlug);
        if (set is null) return null;
        if (!set.IsPublic && set.OwnerUserId != userId) return null;
        return set;
    }

    private async Task<WordSetResponse?> BuildResponse(WordSet? set, Guid userId)
    {
        if (set is null) return null;
        if (!set.IsPublic && set.OwnerUserId != userId) return null;
        var count = await db.Words.CountAsync(w => w.WordSetId == set.Id);
        var prog = await progress.GetAsync(userId, set.Id);
        return set.ToResponse(userId, count, prog?.Status ?? ProgressStatus.NotStarted);
    }

    public async Task<WordSetResponse> CreateAsync(CreateWordSetRequest req, Guid userId)
    {
        var slug = await GenerateUniqueSlugAsync(req.Name);
        var set = new WordSet
        {
            Slug = slug,
            WeekId = req.WeekId,
            Name = req.Name,
            Description = req.Description,
            Level = req.Level,
            IsPublic = req.IsPublic,
            OwnerUserId = req.IsPublic ? null : userId,
            CreatedByUserId = userId,
        };
        await sets.AddAsync(set);
        return set.ToResponse(userId, 0);
    }

    private async Task<string> GenerateUniqueSlugAsync(string name)
    {
        var baseSlug = SlugGenerator.Generate(name);
        var slug = baseSlug;
        int i = 2;
        while (await sets.SlugExistsAsync(slug))
        {
            slug = $"{baseSlug}-{i}";
            i++;
        }
        return slug;
    }

    public async Task<bool> DeleteAsync(Guid id, Guid userId)
    {
        var set = await sets.GetByIdAsync(id);
        if (set is null) return false;
        if (set.CreatedByUserId != userId && set.OwnerUserId != userId) return false;
        await sets.DeleteAsync(set);
        return true;
    }

    public async Task<WordSet> EnsureVocabSetAsync(Guid userId)
    {
        var existing = await sets.GetVocabSetForUserAsync(userId);
        if (existing is not null) return existing;
        var slug = await GenerateUniqueSlugAsync($"my-vocabulary-{userId.ToString()[..8]}");
        var vocab = new WordSet
        {
            Slug = slug,
            OwnerUserId = userId,
            CreatedByUserId = userId,
            IsPublic = false,
            Name = "My Vocabulary",
            Description = "Words you saved from the Reader."
        };
        return await sets.AddAsync(vocab);
    }
}

public record LibraryResponse(
    List<WordSetResponse> Active,
    List<WordSetResponse> Completed,
    List<WordSetResponse> Mine
);
