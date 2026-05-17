using Api.Data;
using Api.DTOs.Requests;
using Api.DTOs.Responses;
using Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Api.Services;

public class ReadingTextService(AppDbContext db, CurrentUserAccessor currentUser)
{
    public async Task<List<ReadingTextResponse>> ListAsync(Guid userId)
    {
        var rows = await db.ReadingTexts
            .Where(t => t.IsPublic || t.CreatedByUserId == userId)
            .OrderByDescending(t => t.CreatedAt)
            .Select(t => new
            {
                t.Id, t.Title, t.Content, t.Level, t.CreatedByUserId, t.IsPublic, t.CreatedAt,
                CreatorName = db.Users.Where(u => u.Id == t.CreatedByUserId).Select(u => u.DisplayName ?? u.Email).FirstOrDefault()
            })
            .ToListAsync();
        return rows.Select(r => new ReadingTextResponse(
            r.Id, r.Title, r.Content, r.Level, r.CreatedByUserId, r.CreatorName, r.IsPublic,
            r.CreatedByUserId == userId, r.CreatedAt
        )).ToList();
    }

    public async Task<ReadingTextResponse?> CreateAsync(CreateReadingTextRequest req, Guid userId)
    {
        var user = await currentUser.GetAsync();
        if (user?.Role == UserRole.ViewOnly) return null;
        var entity = new ReadingText
        {
            Title = req.Title.Trim(),
            Content = req.Content,
            Level = req.Level,
            IsPublic = req.IsPublic,
            CreatedByUserId = userId,
        };
        db.ReadingTexts.Add(entity);
        await db.SaveChangesAsync();
        return new ReadingTextResponse(entity.Id, entity.Title, entity.Content, entity.Level,
            entity.CreatedByUserId, user?.DisplayName ?? user?.Email, entity.IsPublic, true, entity.CreatedAt);
    }

    public async Task<bool> DeleteAsync(Guid id, Guid userId)
    {
        var user = await currentUser.GetAsync();
        var entity = await db.ReadingTexts.FirstOrDefaultAsync(t => t.Id == id);
        if (entity is null) return false;
        if (user?.Role != UserRole.Admin && entity.CreatedByUserId != userId) return false;
        db.ReadingTexts.Remove(entity);
        await db.SaveChangesAsync();
        return true;
    }
}
