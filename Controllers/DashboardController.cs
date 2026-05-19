using Api.DTOs.Responses;
using Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.OutputCaching;

namespace Api.Controllers;

[Route("api/dashboard")]
public class DashboardController(DashboardService service) : BaseController
{
    [HttpGet]
    [OutputCache(PolicyName = "PerUser")]
    public async Task<ActionResult<DashboardResponse>> Get([FromQuery] Guid weekId)
    {
        var userId = GetUserId();
        if (userId is null) return Unauthorized();
        if (weekId == Guid.Empty) return BadRequest(new { error = "weekId is required" });
        return Ok(await service.GetAsync(userId.Value, weekId));
    }
}
