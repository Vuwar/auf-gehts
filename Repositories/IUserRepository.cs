using Api.Models;

namespace Api.Repositories;

public interface IUserRepository
{
    Task<User?> GetByIdAsync(Guid id);
    Task<User> AddAsync(User user);
    Task SaveAsync();
    Task<List<User>> GetAllAsync();
}
