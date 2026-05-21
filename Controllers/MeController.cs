using Api.DTOs.Requests;
using Api.DTOs.Responses;
using Api.Mappings;
using Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace Api.Controllers;

[Route("api/me")]
public class MeController(UserService service, CurrentUserAccessor currentUser) : BaseController
{
    [HttpGet]
    public async Task<ActionResult<UserResponse>> Get()
    {
        // Reuse the accessor's cached/IMemoryCache-backed read. The UserSyncMiddleware
        // has already loaded (and possibly written) the user earlier in the pipeline, so
        // this avoids the redundant SELECT users we used to do on every /api/me hit.
        var user = await currentUser.GetAsync();
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
