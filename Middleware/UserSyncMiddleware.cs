using System.Security.Claims;
using Api.Services;
using Microsoft.Extensions.Caching.Memory;

namespace Api.Middleware;

public class UserSyncMiddleware(RequestDelegate next, IMemoryCache cache)
{
    private static readonly TimeSpan CacheTtl = TimeSpan.FromMinutes(5);

    public async Task InvokeAsync(HttpContext context, UserService userService)
    {
        if (context.User.Identity?.IsAuthenticated == true)
        {
            var sub = context.User.FindFirst("sub")?.Value
                ?? context.User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            var email = context.User.FindFirst("email")?.Value ?? string.Empty;

            if (Guid.TryParse(sub, out var userId))
            {
                var cacheKey = $"usersync:{userId}";
                if (!cache.TryGetValue(cacheKey, out _))
                {
                    await userService.EnsureExistsAsync(userId, email);
                    cache.Set(cacheKey, true, CacheTtl);
                }
            }
        }

        await next(context);
    }
}
