using Api.DTOs.Requests;
using Api.DTOs.Responses;
using Api.Mappings;
using Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace Api.Controllers;

[Route("api/me")]
public class MeController(UserService service) : BaseController
{
    [HttpGet]
    public async Task<ActionResult<UserResponse>> Get()
    {
        var userId = GetUserId();
        if (userId is null) return Unauthorized();
        var user = await service.GetAsync(userId.Value);
        return user is null ? NotFound() : Ok(user.ToResponse());
    }

    [HttpPut]
    public async Task<ActionResult<UserResponse>> Update([FromBody] UpdateUserRequest req)
    {
        var userId = GetUserId();
        if (userId is null) return Unauthorized();
        var user = await service.UpdateAsync(userId.Value, req);
        return user is null ? NotFound() : Ok(user.ToResponse());
    }
}
