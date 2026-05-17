using System.Security.Claims;
using Api.Services;
using Api.Services.Logging;
using Microsoft.Extensions.Caching.Memory;

namespace Api.Middleware;

public class UserSyncMiddleware(RequestDelegate next, IMemoryCache cache, IEventLog events)
{
    private static readonly TimeSpan CacheTtl = TimeSpan.FromMinutes(5);

    public async Task InvokeAsync(HttpContext context, UserService userService, CurrentUserAccessor accessor)
    {
        if (context.User.Identity?.IsAuthenticated == true)
        {
            var sub = context.User.FindFirst("sub")?.Value
                ?? context.User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            var email = context.User.FindFirst("email")?.Value
                ?? context.User.FindFirst(ClaimTypes.Email)?.Value
                ?? string.Empty;

            if (Guid.TryParse(sub, out var userId))
            {
                var cacheKey = $"usersync:{userId}";
                if (cache.TryGetValue(cacheKey, out _))
                {
                    events.Info("cache.hit", "user_sync", metadata: new { key = cacheKey });
                }
                else
                {
                    events.Info("cache.miss", "user_sync", metadata: new { key = cacheKey });
                    var user = await userService.EnsureExistsAsync(userId, email);
                    accessor.SetCached(user);
                    cache.Set(cacheKey, true, CacheTtl);
                }
            }
            else if (!string.IsNullOrEmpty(sub))
            {
                events.Warn("auth.invalid_sub", "JWT sub not parseable as Guid",
                    traceId: context.TraceIdentifier,
                    metadata: new { subLen = sub.Length });
            }
        }

        await next(context);
    }
}
