using Api.DTOs.Requests;
using Api.DTOs.Responses;
using Api.Mappings;
using Api.Models;
using Api.Repositories;
using Api.Services;
using Api.Services.Logging;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Caching.Memory;

namespace Api.Controllers;

[Route("api/admin")]
public class AdminController(IUserRepository userRepo, CurrentUserAccessor currentUser, IMemoryCache cache, IEventLog events) : BaseController
{
    [HttpGet("users")]
    public async Task<ActionResult<List<UserResponse>>> Users()
    {
        var current = await currentUser.GetAsync();
        if (current?.Role != UserRole.Admin) return Forbid();
        var users = await userRepo.GetAllAsync();
        return Ok(users.Select(u => u.ToResponse()).ToList());
    }

    [HttpPut("users/{id:guid}/role")]
    public async Task<ActionResult<UserResponse>> SetRole(Guid id, [FromBody] UpdateRoleRequest req)
    {
        var current = await currentUser.GetAsync();
        if (current?.Role != UserRole.Admin) return Forbid();
        if (!Enum.TryParse<UserRole>(req.Role, true, out var role)) return BadRequest(new { error = "Invalid role" });
        var target = await userRepo.GetByIdAsync(id);
        if (target is null) return NotFound();
        target.Role = role;
        await userRepo.SaveAsync();
        CurrentUserAccessor.Invalidate(cache, id);
        events.Write(EventLogLevel.Info, "activity.user.role_changed",
            message: $"{target.Email} -> {role}", userId: current.Id, source: "AdminController",
            metadata: new { targetUserId = id, targetEmail = target.Email, role = role.ToString() });
        return Ok(target.ToResponse());
    }

    [HttpDelete("users/{id:guid}")]
    public async Task<IActionResult> DeleteUser(Guid id)
    {
        var current = await currentUser.GetAsync();
        if (current?.Role != UserRole.Admin) return Forbid();
        if (current.Id == id) return BadRequest(new { error = "Cannot delete your own account" });
        var target = await userRepo.GetByIdAsync(id);
        if (target is null) return NotFound();
        var targetEmail = target.Email;
        await userRepo.DeleteAsync(target);
        CurrentUserAccessor.Invalidate(cache, id);
        events.Write(EventLogLevel.Info, "activity.user.deleted",
            message: targetEmail, userId: current.Id, source: "AdminController",
            metadata: new { targetUserId = id, targetEmail });
        return NoContent();
    }
}
