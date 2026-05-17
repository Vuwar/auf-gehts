using Api.Models;
using Api.Repositories;

namespace Api.Services;

public class ProgressService(IProgressRepository repo, IUserRepository userRepo)
{
    public async Task<UserSetProgress> SetStatusAsync(Guid userId, Guid setId, ProgressStatus status)
    {
        var result = await repo.UpsertAsync(userId, setId, status);
        if (status == ProgressStatus.Completed)
        {
            await BumpStreakAsync(userId);
        }
        return result;
    }

    private async Task BumpStreakAsync(Guid userId)
    {
        var user = await userRepo.GetByIdAsync(userId);
        if (user is null) return;
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        if (user.LastActivityDate == today) return;
        if (user.LastActivityDate == today.AddDays(-1)) user.CurrentStreak++;
        else user.CurrentStreak = 1;
        if (user.CurrentStreak > user.LongestStreak) user.LongestStreak = user.CurrentStreak;
        user.LastActivityDate = today;
        await userRepo.SaveAsync();
    }

    public Task<List<UserSetProgress>> GetActiveAsync(Guid userId) =>
        repo.GetByStatusAsync(userId, ProgressStatus.Active);

    public Task<List<UserSetProgress>> GetCompletedAsync(Guid userId) =>
        repo.GetByStatusAsync(userId, ProgressStatus.Completed);

    public Task<UserSetProgress> SetFavoriteAsync(Guid userId, Guid setId, bool isFavorite) =>
        repo.SetFavoriteAsync(userId, setId, isFavorite);
}
