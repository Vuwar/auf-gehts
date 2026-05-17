using Api.Data;
using Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Api.Repositories;

public class UserRepository(AppDbContext db) : IUserRepository
{
    public Task<User?> GetByIdAsync(Guid id) =>
        db.Users.FirstOrDefaultAsync(u => u.Id == id);

    public async Task<User> AddAsync(User user)
    {
        db.Users.Add(user);
        await db.SaveChangesAsync();
        return user;
    }

    public Task SaveAsync() => db.SaveChangesAsync();

    public Task<List<User>> GetAllAsync() =>
        db.Users.OrderBy(u => u.Email).ToListAsync();

    public Task DeleteAsync(User user)
    {
        db.Users.Remove(user);
        return db.SaveChangesAsync();
    }
}
