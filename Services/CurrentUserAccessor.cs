using System.Security.Claims;
using Api.Models;
using Api.Repositories;

namespace Api.Services;

public class CurrentUserAccessor(IHttpContextAccessor httpAccessor, IUserRepository userRepo)
{
    private User? _cached;
    private bool _fetched;

    public Guid? GetUserId()
    {
        var ctx = httpAccessor.HttpContext;
        var sub = ctx?.User.FindFirst("sub")?.Value
            ?? ctx?.User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        return Guid.TryParse(sub, out var id) ? id : null;
    }

    public async Task<User?> GetAsync()
    {
        if (_fetched) return _cached;
        _fetched = true;
        var userId = GetUserId();
        if (userId is null) return null;
        _cached = await userRepo.GetByIdAsync(userId.Value);
        return _cached;
    }

    public void SetCached(User user)
    {
        _cached = user;
        _fetched = true;
    }
}
