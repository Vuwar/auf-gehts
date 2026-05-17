using Api.Data;
using Api.DTOs.Requests;
using Api.DTOs.Responses;
using Api.Mappings;
using Api.Models;
using Api.Repositories;
using Microsoft.EntityFrameworkCore;

namespace Api.Services;

public class VocabService(WordSetService setService, IWordRepository words, AppDbContext db)
{
    public async Task<WordResponse> SaveAsync(SaveToVocabRequest req, Guid userId)
    {
        var vocabSet = await setService.EnsureVocabSetAsync(userId);
        var word = new Word
        {
            WordSetId = vocabSet.Id,
            Front = req.Front,
            Back = req.Back,
            Context = req.Context,
        };
        await words.AddAsync(word);
        return word.ToResponse();
    }

    public async Task<List<string>> GetFrontsAsync(Guid userId)
    {
        var vocab = await setService.EnsureVocabSetAsync(userId);
        return await db.Words
            .Where(w => w.WordSetId == vocab.Id)
            .Select(w => w.Front.ToLower())
            .ToListAsync();
    }
}
