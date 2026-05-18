using Api.DTOs.Responses;
using Api.Repositories;
using Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.OutputCaching;

namespace Api.Controllers;

[Route("api/weeks")]
public class WeeksController(WeekService service, IWeekRepository repo) : BaseController
{
    [HttpGet]
    [OutputCache(PolicyName = "PerUser")]
    public async Task<ActionResult<List<WeekResponse>>> List()
    {
        var userId = GetUserId();
        if (userId is null) return Unauthorized();
        return Ok(await service.ListAsync(userId.Value));
    }

    [HttpGet("{idOrNumber}")]
    [OutputCache(PolicyName = "PerUser")]
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

    [HttpPost]
    public async Task<ActionResult<object>> Create([FromBody] DTOs.Requests.CreateWeekRequest req)
    {
        var (week, error) = await service.CreateAsync(req);
        if (week is null) return BadRequest(new { error });
        return Ok(new { id = week.Id, number = week.Number, title = week.Title, description = week.Description });
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<object>> Update(Guid id, [FromBody] DTOs.Requests.UpdateWeekRequest req)
    {
        var (week, error) = await service.UpdateAsync(id, req);
        if (week is null) return BadRequest(new { error });
        return Ok(new { id = week.Id, number = week.Number, title = week.Title, description = week.Description });
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var ok = await service.DeleteAsync(id);
        return ok ? NoContent() : Forbid();
    }

    [HttpGet("{idOrNumber}/combined-set")]
    public async Task<ActionResult<WordSetResponse>> CombinedSet(string idOrNumber)
    {
        var userId = GetUserId();
        if (userId is null) return Unauthorized();
        var weekId = await ResolveWeekIdAsync(idOrNumber);
        if (weekId is null) return NotFound();
        var resp = await service.GetCombinedSetAsync(weekId.Value, userId.Value);
        return resp is null ? NotFound() : Ok(resp);
    }

    [HttpGet("{idOrNumber}/combined-set/words")]
    public async Task<ActionResult<List<WordResponse>>> CombinedWords(string idOrNumber)
    {
        var userId = GetUserId();
        if (userId is null) return Unauthorized();
        var weekId = await ResolveWeekIdAsync(idOrNumber);
        if (weekId is null) return NotFound();
        return Ok(await service.GetCombinedWordsAsync(weekId.Value));
    }

    [HttpPut("{idOrNumber}/combined-set/progress")]
    public async Task<IActionResult> CombinedProgress(string idOrNumber, [FromBody] DTOs.Requests.UpdateProgressRequest req)
    {
        var userId = GetUserId();
        if (userId is null) return Unauthorized();
        var weekId = await ResolveWeekIdAsync(idOrNumber);
        if (weekId is null) return NotFound();
        if (!Enum.TryParse<Models.ProgressStatus>(req.Status, out var status)) return BadRequest(new { error = "Invalid status" });
        await service.SetCombinedProgressAsync(weekId.Value, userId.Value, status);
        return NoContent();
    }

    private async Task<Guid?> ResolveWeekIdAsync(string idOrNumber)
    {
        if (Guid.TryParse(idOrNumber, out var id)) return id;
        if (int.TryParse(idOrNumber, out var num))
        {
            var w = await repo.GetByNumberAsync(num);
            return w?.Id;
        }
        return null;
    }
}
