using Api.Models;

namespace Api.Repositories;

public interface IProgressRepository
{
    Task<UserSetProgress?> GetAsync(Guid userId, Guid setId);
    Task<Dictionary<Guid, ProgressStatus>> GetStatusesForUserAsync(Guid userId);
    Task<List<UserSetProgress>> GetByStatusAsync(Guid userId, ProgressStatus status);
    Task<UserSetProgress> UpsertAsync(Guid userId, Guid setId, ProgressStatus status);
    Task<UserSetProgress> SetFavoriteAsync(Guid userId, Guid setId, bool isFavorite);
    Task<List<UserSetProgress>> GetFavoritesAsync(Guid userId);
}
