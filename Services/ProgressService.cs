using Api.Models;
using Api.Repositories;

namespace Api.Services;

public class ProgressService(IProgressRepository repo)
{
    public Task<UserSetProgress> SetStatusAsync(Guid userId, Guid setId, ProgressStatus status) =>
        repo.UpsertAsync(userId, setId, status);

    public Task<List<UserSetProgress>> GetActiveAsync(Guid userId) =>
        repo.GetByStatusAsync(userId, ProgressStatus.Active);

    public Task<List<UserSetProgress>> GetCompletedAsync(Guid userId) =>
        repo.GetByStatusAsync(userId, ProgressStatus.Completed);
}
