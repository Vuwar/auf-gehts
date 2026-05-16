using Api.DTOs.Responses;
using Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace Api.Controllers;

[Route("api/dashboard")]
public class DashboardController(DashboardService service) : BaseController
{
    [HttpGet]
    public async Task<ActionResult<DashboardResponse>> Get()
    {
        var userId = GetUserId();
        if (userId is null) return Unauthorized();
        return Ok(await service.GetAsync(userId.Value));
    }
}
