using Api.DTOs.Requests;
using Api.Models;
using Api.Repositories;
using Api.Services.Logging;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;

namespace Api.Services;

public class UserService(IUserRepository repo, IMemoryCache cache, IEventLog events)
{
    public async Task<User> EnsureExistsAsync(Guid id, string email)
    {
        var user = await repo.GetByIdAsync(id);
        if (user is null)
        {
            try
            {
                user = await repo.AddAsync(new User { Id = id, Email = email });
                // First time we ever saw this account -> sign-up.
                events.Write(EventLogLevel.Info, "activity.signup",
                    message: email, userId: id, source: "UserService",
                    metadata: new { email });
            }
            catch (DbUpdateException)
            {
                // Race condition: another concurrent request created the user. Detach the
                // failed Added entity so it doesn't get re-batched into a later SaveChanges
                // (which would re-trigger 23505 and roll back unrelated work), then re-fetch.
                repo.DetachAdded(id);
                user = await repo.GetByIdAsync(id);
                if (user is null) throw;
            }
        }
        else if (user.LastSeenAt < DateTime.UtcNow.AddMinutes(-5))
        {
            user.LastSeenAt = DateTime.UtcNow;
            if (!string.IsNullOrEmpty(email) && user.Email != email) user.Email = email;
            await repo.SaveAsync();
            // EnsureExistsAsync only runs on a usersync cache miss (>=5min since last
            // request), so this fires roughly once per session = login / app open.
            events.Write(EventLogLevel.Info, "activity.app_open",
                userId: id, source: "UserService");
        }
        return user;
    }

    public Task<User?> GetAsync(Guid id) => repo.GetByIdAsync(id);

    public async Task<User?> UpdateAsync(Guid id, UpdateUserRequest req)
    {
        var user = await repo.GetByIdAsync(id);
        if (user is null) return null;
        if (req.DisplayName is not null) user.DisplayName = req.DisplayName;
        if (req.AnthropicApiKey is not null)
        {
            user.AnthropicApiKey = string.IsNullOrWhiteSpace(req.AnthropicApiKey) ? null : req.AnthropicApiKey;
        }
        await repo.SaveAsync();
        CurrentUserAccessor.Invalidate(cache, id);
        return user;
    }
}
