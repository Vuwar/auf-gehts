using Api.Models;

namespace Api.Repositories;

public interface IRepository<T> where T : class, IUserOwned
{
    Task<List<T>> GetAllAsync(Guid userId);
    Task<T?> GetByIdAsync(Guid id, Guid userId);
    Task<T> AddAsync(T entity);
    Task AddRangeAsync(IEnumerable<T> entities);
    Task SaveAsync();
    Task DeleteAsync(T entity);
    Task DeleteRangeAsync(IEnumerable<T> entities);
}
