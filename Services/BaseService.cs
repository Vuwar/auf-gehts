using Api.Models;
using Api.Repositories;

namespace Api.Services;

public abstract class BaseService<T>(IRepository<T> repo) where T : class, IUserOwned
{
    protected readonly IRepository<T> _repo = repo;

    public virtual Task<List<T>> ListAsync(Guid userId) => _repo.GetAllAsync(userId);

    public virtual Task<T?> GetAsync(Guid id, Guid userId) => _repo.GetByIdAsync(id, userId);

    public virtual Task<T> CreateAsync(T entity) => _repo.AddAsync(entity);

    public virtual async Task<bool> DeleteAsync(Guid id, Guid userId)
    {
        var entity = await _repo.GetByIdAsync(id, userId);
        if (entity is null) return false;
        await _repo.DeleteAsync(entity);
        return true;
    }
}
