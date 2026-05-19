using Api.DTOs.Responses;
using Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.OutputCaching;

namespace Api.Controllers;

[Route("api/users")]
public class UsersController(UserProfileService profile) : BaseController
{
    [HttpGet("directory")]
    public async Task<ActionResult<UserDirectoryResponse>> Directory(
        [FromQuery] string? q,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 25)
    {
        var userId = GetUserId();
        if (userId is null) return Unauthorized();
        return Ok(await profile.BrowseDirectoryAsync(userId.Value, q, page, pageSize));
    }

    [HttpGet("{id:guid}/profile")]
    [OutputCache(PolicyName = "PerUser")]
    public async Task<ActionResult<UserProfileResponse>> Get(Guid id)
    {
        var userId = GetUserId();
        if (userId is null) return Unauthorized();
        var resp = await profile.GetProfileAsync(userId.Value, id);
        return resp is null ? NotFound() : Ok(resp);
    }
}
