using Api.Data;
using Api.DTOs.Responses;
using Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Api.Services;

public class StatsService(AppDbContext db, WordSetService setService)
{
    public async Task<StatsResponse> GetForUserAsync(Guid userId)
    {
        var vocab = await setService.EnsureVocabSetAsync(userId);
        var vocabCount = await db.Words.CountAsync(w => w.WordSetId == vocab.Id);
        var active = await db.UserSetProgress.CountAsync(p => p.UserId == userId && p.Status == ProgressStatus.Active);
        var completed = await db.UserSetProgress.CountAsync(p => p.UserId == userId && p.Status == ProgressStatus.Completed);
        var weekAgo = DateTime.UtcNow.AddDays(-7);
        var weekAdds = await db.Words.CountAsync(w => w.WordSetId == vocab.Id && w.CreatedAt >= weekAgo);

        return new StatsResponse(vocabCount, active, completed, weekAdds);
    }
}
