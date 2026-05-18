using Api.Models;

namespace Api.Repositories;

public interface IUserRepository
{
    Task<User?> GetByIdAsync(Guid id);
    Task<User> AddAsync(User user);
    Task SaveAsync();
    Task<List<User>> GetAllAsync();
    Task DeleteAsync(User user);

    // Detach any User entity tracked in Added state for `id`, so a previously
    // failed insert doesn't get re-attempted by the next SaveChanges in the scope.
    void DetachAdded(Guid id);
}
