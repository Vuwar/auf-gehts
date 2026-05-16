using Api.DTOs.Responses;
using Api.Repositories;
using Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace Api.Controllers;

[Route("api/weeks")]
public class WeeksController(WeekService service, IWeekRepository repo) : BaseController
{
    [HttpGet]
    public async Task<ActionResult<List<WeekResponse>>> List()
    {
        var userId = GetUserId();
        if (userId is null) return Unauthorized();
        return Ok(await service.ListAsync(userId.Value));
    }

    [HttpGet("{idOrNumber}")]
    public async Task<ActionResult<WeekDetailResponse>> Get(string idOrNumber)
    {
        var userId = GetUserId();
        if (userId is null) return Unauthorized();

        Guid? weekId = null;
        if (Guid.TryParse(idOrNumber, out var id)) weekId = id;
        else if (int.TryParse(idOrNumber, out var num))
        {
            var w = await repo.GetByNumberAsync(num);
            weekId = w?.Id;
        }
        if (weekId is null) return NotFound();

        var week = await service.GetAsync(weekId.Value, userId.Value);
        return week is null ? NotFound() : Ok(week);
    }
}
