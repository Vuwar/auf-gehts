using Api.Data;
using Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Api.Repositories;

public class WeekRepository(AppDbContext db) : IWeekRepository
{
    public Task<List<Week>> GetAllAsync() =>
        db.Weeks.OrderBy(w => w.Number).ToListAsync();

    public Task<Week?> GetByIdAsync(Guid id) =>
        db.Weeks.FirstOrDefaultAsync(w => w.Id == id);

    public Task<Week?> GetByNumberAsync(int number) =>
        db.Weeks.FirstOrDefaultAsync(w => w.Number == number);

    public async Task<Week> AddAsync(Week week)
    {
        db.Weeks.Add(week);
        await db.SaveChangesAsync();
        return week;
    }
}
