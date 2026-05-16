using Api.DTOs.Responses;
using Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace Api.Controllers;

public class StatsController(StatsService service) : BaseController
{
    [HttpGet]
    public async Task<ActionResult<StatsResponse>> Get()
    {
        var userId = GetUserId();
        if (userId is null) return Unauthorized();
        return Ok(await service.GetForUserAsync(userId.Value));
    }
}
