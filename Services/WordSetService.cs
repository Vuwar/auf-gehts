using Api.Data;
using Api.DTOs.Requests;
using Api.DTOs.Responses;
using Api.Mappings;
using Api.Models;
using Api.Repositories;
using Api.Services.Logging;
using Api.Utils;
using Microsoft.EntityFrameworkCore;

namespace Api.Services;

public class WordSetService(
    IWordSetRepository sets,
    IProgressRepository progress,
    CurrentUserAccessor currentUser,
    AppDbContext db,
    IEventLog events)
{
    public async Task<LibraryResponse> ListForLibraryAsync(Guid userId)
    {
        var userProgress = await db.UserSetProgress
            .Include(p => p.WordSet).ThenInclude(s => s.Week)
            .Include(p => p.WordSet).ThenInclude(s => s.CreatedByUser)
            .Where(p => p.UserId == userId
                && (p.WordSet.IsPublic || p.WordSet.CreatedByUserId == userId))
            .OrderByDescending(p => p.LastReviewedAt)
            .ToListAsync();

        var ownedRaw = await db.WordSets
            .Include(s => s.Week)
            .Include(s => s.CreatedByUser)
            .Where(s => s.CreatedByUserId == userId && !s.IsOfficial)
            .OrderByDescending(s => s.CreatedAt)
            .Select(s => new { Set = s, WordCount = s.Words.Count })
            .ToListAsync();

        var vocab = await sets.GetVocabSetForUserAsync(userId);
        var mineRaw = ownedRaw.ToList();
        if (vocab is not null && !mineRaw.Any(r => r.Set.Id == vocab.Id))
        {
            var vocabCount = await db.Words.CountAsync(w => w.WordSetId == vocab.Id);
            mineRaw.Add(new { Set = vocab, WordCount = vocabCount });
        }

        var progressSetIds = userProgress.Select(p => p.WordSetId).ToList();
        var progressCounts = progressSetIds.Count == 0
            ? new Dictionary<Guid, int>()
            : await db.Words
                .Where(w => progressSetIds.Contains(w.WordSetId))
                .GroupBy(w => w.WordSetId)
                .Select(g => new { Id = g.Key, Count = g.Count() })
                .ToDictionaryAsync(x => x.Id, x => x.Count);

        var progressMap = userProgress.ToDictionary(p => p.WordSetId, p => p);
        var favoriteIds = userProgress.Where(p => p.IsFavorite).Select(p => p.WordSetId).ToHashSet();

        var favorites = userProgress
            .Where(p => p.IsFavorite)
            .Select(p => p.WordSet.ToResponse(userId,
                progressCounts.GetValueOrDefault(p.WordSetId, 0),
                p.Status,
                true))
            .ToList();

        var completed = userProgress
            .Where(p => p.Status == ProgressStatus.Completed)
            .Select(p => p.WordSet.ToResponse(userId,
                progressCounts.GetValueOrDefault(p.WordSetId, 0),
                p.Status,
                p.IsFavorite))
            .ToList();

        // My sets exclude favorited (dedupe — favorited owned shows in Favorites only)
        var mine = mineRaw
            .Where(r => !favoriteIds.Contains(r.Set.Id))
            .Select(r =>
            {
                var p = progressMap.GetValueOrDefault(r.Set.Id);
                return r.Set.ToResponse(userId, r.WordCount,
                    p?.Status ?? ProgressStatus.NotStarted,
                    p?.IsFavorite ?? false);
            })
            .ToList();

        // Browse: public, not mine, not favorited, no progress
        var ownedIds = ownedRaw.Select(r => r.Set.Id).ToHashSet();
        var progressIds = progressMap.Keys.ToHashSet();
        var browseRaw = await db.WordSets
            .Include(s => s.Week)
            .Include(s => s.CreatedByUser)
            .Where(s => s.IsPublic
                && !s.IsOfficial
                && s.CreatedByUserId != userId
                && !progressIds.Contains(s.Id))
            .OrderByDescending(s => s.CreatedAt)
            .Select(s => new { Set = s, WordCount = s.Words.Count })
            .ToListAsync();
        var browse = browseRaw
            .Where(r => !ownedIds.Contains(r.Set.Id))
            .Select(r => r.Set.ToResponse(userId, r.WordCount, ProgressStatus.NotStarted, false))
            .ToList();

        return new LibraryResponse(favorites, mine, completed, browse);
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
        if (!set.IsPublic && set.CreatedByUserId != userId) return null;
        return set;
    }

    private async Task<WordSetResponse?> BuildResponse(WordSet? set, Guid userId)
    {
        if (set is null) return null;
        if (!set.IsPublic && set.CreatedByUserId != userId) return null;
        var count = await db.Words.CountAsync(w => w.WordSetId == set.Id);
        var prog = await progress.GetAsync(userId, set.Id);
        return set.ToResponse(userId, count, prog?.Status ?? ProgressStatus.NotStarted, prog?.IsFavorite ?? false);
    }

    public async Task<(WordSetResponse? Response, string? Error)> CreateAsync(CreateWordSetRequest req, Guid userId)
    {
        var user = await currentUser.GetAsync();
        if (user is null) return (null, "User not found");
        if (user.Role == UserRole.ViewOnly) return (null, "Read-only account");

        var isOfficial = req.IsOfficial && user.Role == UserRole.Admin && req.IsPublic;
        var weekId = (user.Role == UserRole.Admin) ? req.WeekId : null;

        var slug = await GenerateUniqueSlugAsync(req.Name);
        var set = new WordSet
        {
            Slug = slug,
            WeekId = weekId,
            Name = req.Name,
            Description = req.Description,
            Level = req.Level,
            IsPublic = req.IsPublic,
            IsOfficial = isOfficial,
            CreatedByUserId = userId,
            CreatedByUser = user,
        };
        await sets.AddAsync(set);
        events.Write(EventLogLevel.Info, "activity.wordset.created",
            message: set.Name, userId: userId, source: "WordSetService",
            metadata: new { setId = set.Id, name = set.Name });
        return (set.ToResponse(userId, 0), null);
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

    public async Task<WordSetResponse?> UpdateAsync(Guid id, UpdateWordSetRequest req, Guid userId)
    {
        var user = await currentUser.GetAsync();
        if (user?.Role == UserRole.ViewOnly) return null;
        var set = await sets.GetByIdAsync(id);
        if (set is null) return null;
        if (user?.Role != UserRole.Admin && set.CreatedByUserId != userId) return null;

        if (req.Name is not null && req.Name.Trim().Length > 0) set.Name = req.Name.Trim();
        if (req.Description is not null) set.Description = req.Description;
        if (req.Level is not null) set.Level = req.Level;
        if (req.IsPublic.HasValue)
        {
            set.IsPublic = req.IsPublic.Value;
            if (!set.IsPublic) set.IsOfficial = false; // private cannot be official
        }

        if (user?.Role == UserRole.Admin)
        {
            if (req.ClearWeek) set.WeekId = null;
            else if (req.WeekId.HasValue) set.WeekId = req.WeekId.Value;
            if (req.IsOfficial.HasValue) set.IsOfficial = req.IsOfficial.Value && set.IsPublic;
        }

        await sets.SaveAsync();
        events.Write(EventLogLevel.Info, "activity.wordset.updated",
            message: set.Name, userId: userId, source: "WordSetService",
            metadata: new { setId = set.Id, name = set.Name });
        var count = await db.Words.CountAsync(w => w.WordSetId == set.Id);
        var prog = await progress.GetAsync(userId, set.Id);
        return set.ToResponse(userId, count, prog?.Status ?? ProgressStatus.NotStarted, prog?.IsFavorite ?? false);
    }

    public async Task<bool> DeleteAsync(Guid id, Guid userId)
    {
        var user = await currentUser.GetAsync();
        if (user?.Role == UserRole.ViewOnly) return false;
        var set = await sets.GetByIdAsync(id);
        if (set is null) return false;
        if (user?.Role != UserRole.Admin && set.CreatedByUserId != userId) return false;
        var name = set.Name;
        await sets.DeleteAsync(set);
        events.Write(EventLogLevel.Info, "activity.wordset.deleted",
            message: name, userId: userId, source: "WordSetService",
            metadata: new { setId = id, name });
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
            CreatedByUserId = userId,
            IsPublic = false,
            IsOfficial = false,
            Name = "My Vocabulary",
            Description = "Words you saved from the Reader."
        };
        return await sets.AddAsync(vocab);
    }

    // For admin "add existing set to week" search
    public async Task<List<WordSetResponse>> SearchPublicAsync(string? q, Guid userId)
    {
        var user = await currentUser.GetAsync();
        if (user?.Role != UserRole.Admin) return [];
        var query = db.WordSets
            .Include(s => s.Week)
            .Include(s => s.CreatedByUser)
            .Where(s => s.IsPublic);
        if (!string.IsNullOrWhiteSpace(q))
        {
            var lower = q.ToLower();
            query = query.Where(s => s.Name.ToLower().Contains(lower));
        }
        var rows = await query
            .OrderBy(s => s.Name)
            .Take(50)
            .Select(s => new { Set = s, WordCount = s.Words.Count })
            .ToListAsync();
        return rows.Select(r => r.Set.ToResponse(userId, r.WordCount)).ToList();
    }
}

public record LibraryResponse(
    List<WordSetResponse> Favorites,
    List<WordSetResponse> Mine,
    List<WordSetResponse> Completed,
    List<WordSetResponse> Browse
);
