using System.Security.Claims;
using Api.Models;
using Api.Repositories;
using Microsoft.Extensions.Caching.Memory;

namespace Api.Services;

public class CurrentUserAccessor(IHttpContextAccessor httpAccessor, IUserRepository userRepo, IMemoryCache cache)
{
    private static readonly TimeSpan CacheTtl = TimeSpan.FromMinutes(5);
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

        if (cache.TryGetValue<User>(CacheKey(userId.Value), out var hit) && hit is not null)
        {
            _cached = hit;
            return _cached;
        }

        _cached = await userRepo.GetByIdAsync(userId.Value);
        if (_cached is not null) cache.Set(CacheKey(userId.Value), _cached, CacheTtl);
        return _cached;
    }

    public void SetCached(User user)
    {
        _cached = user;
        _fetched = true;
        cache.Set(CacheKey(user.Id), user, CacheTtl);
    }

    public static void Invalidate(IMemoryCache cache, Guid userId) => cache.Remove(CacheKey(userId));

    private static string CacheKey(Guid userId) => $"user:{userId}";
}
