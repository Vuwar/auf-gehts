using Api.Models;

namespace Api.Repositories;

public interface IWeekRepository
{
    Task<List<Week>> GetAllAsync();
    Task<Week?> GetByIdAsync(Guid id);
    Task<Week?> GetByNumberAsync(int number);
    Task<Week> AddAsync(Week week);
    Task SaveAsync();
    Task DeleteAsync(Week week);
}
