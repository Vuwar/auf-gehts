using Api.DTOs.Requests;
using Api.DTOs.Responses;
using Api.Mappings;
using Api.Models;
using Api.Repositories;
using Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace Api.Controllers;

[Route("api/admin")]
public class AdminController(IUserRepository userRepo, CurrentUserAccessor currentUser) : BaseController
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
        return Ok(target.ToResponse());
    }
}
