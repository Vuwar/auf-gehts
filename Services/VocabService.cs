using Api.DTOs.Requests;
using Api.DTOs.Responses;
using Api.Mappings;
using Api.Models;
using Api.Repositories;

namespace Api.Services;

public class VocabService(WordSetService setService, IWordRepository words)
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
}
