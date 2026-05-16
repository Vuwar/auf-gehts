using Api.Data;
using Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Api.Repositories;

public class BaseRepository<T>(AppDbContext db) : IRepository<T> where T : class, IUserOwned
{
    protected readonly AppDbContext _db = db;
    protected DbSet<T> Set => _db.Set<T>();

    public virtual Task<List<T>> GetAllAsync(Guid userId) =>
        Set.Where(e => e.UserId == userId).ToListAsync();

    public virtual Task<T?> GetByIdAsync(Guid id, Guid userId) =>
        Set.FirstOrDefaultAsync(e => e.Id == id && e.UserId == userId);

    public virtual async Task<T> AddAsync(T entity)
    {
        Set.Add(entity);
        await _db.SaveChangesAsync();
        return entity;
    }

    public virtual Task AddRangeAsync(IEnumerable<T> entities)
    {
        Set.AddRange(entities);
        return _db.SaveChangesAsync();
    }

    public virtual Task SaveAsync() => _db.SaveChangesAsync();

    public virtual Task DeleteAsync(T entity)
    {
        Set.Remove(entity);
        return _db.SaveChangesAsync();
    }

    public virtual Task DeleteRangeAsync(IEnumerable<T> entities)
    {
        Set.RemoveRange(entities);
        return _db.SaveChangesAsync();
    }
}
