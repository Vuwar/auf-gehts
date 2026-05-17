using Api.Data;
using Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Api.Repositories;

public class ProgressRepository(AppDbContext db) : IProgressRepository
{
    public Task<UserSetProgress?> GetAsync(Guid userId, Guid setId) =>
        db.UserSetProgress.FirstOrDefaultAsync(p => p.UserId == userId && p.WordSetId == setId);

    public async Task<Dictionary<Guid, ProgressStatus>> GetStatusesForUserAsync(Guid userId)
    {
        var rows = await db.UserSetProgress
            .Where(p => p.UserId == userId)
            .Select(p => new { p.WordSetId, p.Status })
            .ToListAsync();
        return rows.ToDictionary(r => r.WordSetId, r => r.Status);
    }

    public Task<List<UserSetProgress>> GetByStatusAsync(Guid userId, ProgressStatus status) =>
        db.UserSetProgress
          .Include(p => p.WordSet).ThenInclude(s => s.Week)
          .Where(p => p.UserId == userId && p.Status == status)
          .OrderByDescending(p => p.LastReviewedAt)
          .ToListAsync();

    public async Task<UserSetProgress> UpsertAsync(Guid userId, Guid setId, ProgressStatus status)
    {
        var existing = await db.UserSetProgress.FirstOrDefaultAsync(p => p.UserId == userId && p.WordSetId == setId);
        var now = DateTime.UtcNow;
        if (existing is null)
        {
            existing = new UserSetProgress
            {
                UserId = userId,
                WordSetId = setId,
                Status = status,
                StartedAt = status >= ProgressStatus.Active ? now : null,
                CompletedAt = status == ProgressStatus.Completed ? now : null,
                LastReviewedAt = now,
            };
            db.UserSetProgress.Add(existing);
        }
        else
        {
            existing.Status = status;
            if (status >= ProgressStatus.Active && existing.StartedAt is null) existing.StartedAt = now;
            if (status == ProgressStatus.Completed) existing.CompletedAt = now;
            existing.LastReviewedAt = now;
        }
        await db.SaveChangesAsync();
        return existing;
    }

    public async Task<UserSetProgress> SetFavoriteAsync(Guid userId, Guid setId, bool isFavorite)
    {
        var existing = await db.UserSetProgress.FirstOrDefaultAsync(p => p.UserId == userId && p.WordSetId == setId);
        if (existing is null)
        {
            existing = new UserSetProgress
            {
                UserId = userId,
                WordSetId = setId,
                Status = ProgressStatus.NotStarted,
                IsFavorite = isFavorite,
                LastReviewedAt = DateTime.UtcNow,
            };
            db.UserSetProgress.Add(existing);
        }
        else
        {
            existing.IsFavorite = isFavorite;
        }
        await db.SaveChangesAsync();
        return existing;
    }

    public Task<List<UserSetProgress>> GetFavoritesAsync(Guid userId) =>
        db.UserSetProgress
          .Include(p => p.WordSet).ThenInclude(s => s.Week)
          .Where(p => p.UserId == userId && p.IsFavorite)
          .OrderByDescending(p => p.LastReviewedAt)
          .ToListAsync();
}
