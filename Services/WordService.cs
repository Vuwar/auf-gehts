using Api.DTOs.Requests;
using Api.DTOs.Responses;
using Api.Mappings;
using Api.Models;
using Api.Repositories;

namespace Api.Services;

public class WordService(IWordRepository words, IWordSetRepository sets)
{
    public async Task<List<WordResponse>?> ListBySetAsync(Guid setId, Guid currentUserId)
    {
        var set = await sets.GetByIdAsync(setId);
        if (set is null) return null;
        if (!set.IsPublic && set.OwnerUserId != currentUserId) return null;
        var list = await words.ListBySetAsync(setId);
        return list.Select(w => w.ToResponse()).ToList();
    }

    public async Task<WordResponse?> CreateAsync(Guid setId, CreateWordRequest req, Guid userId)
    {
        var set = await sets.GetByIdAsync(setId);
        if (set is null) return null;
        if (!CanEdit(set, userId)) return null;
        var word = new Word
        {
            WordSetId = setId,
            Front = req.Front,
            Back = req.Back,
            Context = req.Context,
        };
        await words.AddAsync(word);
        return word.ToResponse();
    }

    public async Task<int?> BulkAddAsync(Guid setId, BulkAddWordsRequest req, Guid userId)
    {
        var set = await sets.GetByIdAsync(setId);
        if (set is null) return null;
        if (!CanEdit(set, userId)) return null;
        var entities = req.Words.Select(w => new Word
        {
            WordSetId = setId,
            Front = w.Front,
            Back = w.Back,
            Context = w.Context,
        }).ToList();
        await words.AddRangeAsync(entities);
        return entities.Count;
    }

    public async Task<bool> DeleteAsync(Guid id, Guid userId)
    {
        var word = await words.GetByIdAsync(id);
        if (word is null) return false;
        var set = await sets.GetByIdAsync(word.WordSetId);
        if (set is null || !CanEdit(set, userId)) return false;
        await words.DeleteAsync(word);
        return true;
    }

    private static bool CanEdit(WordSet set, Guid userId) =>
        set.IsPublic
            ? set.CreatedByUserId == userId  // public sets editable by creator
            : set.OwnerUserId == userId;     // private sets editable by owner
}
