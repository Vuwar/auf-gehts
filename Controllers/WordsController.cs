using Api.DTOs.Requests;
using Api.DTOs.Responses;
using Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace Api.Controllers;

[Route("api")]
public class WordsController(WordService service, WordSetService setService) : BaseController
{
    private async Task<Guid?> ResolveSetIdAsync(string idOrSlug, Guid userId)
    {
        var set = await setService.ResolveAsync(idOrSlug, userId);
        return set?.Id;
    }

    [HttpGet("sets/{idOrSlug}/words")]
    public async Task<ActionResult<List<WordResponse>>> List(string idOrSlug)
    {
        var userId = GetUserId();
        if (userId is null) return Unauthorized();
        var setId = await ResolveSetIdAsync(idOrSlug, userId.Value);
        if (setId is null) return NotFound();
        var list = await service.ListBySetAsync(setId.Value, userId.Value);
        return list is null ? NotFound() : Ok(list);
    }

    [HttpPost("sets/{idOrSlug}/words")]
    public async Task<ActionResult<WordResponse>> Create(string idOrSlug, [FromBody] CreateWordRequest req)
    {
        var userId = GetUserId();
        if (userId is null) return Unauthorized();
        var setId = await ResolveSetIdAsync(idOrSlug, userId.Value);
        if (setId is null) return NotFound();
        var w = await service.CreateAsync(setId.Value, req, userId.Value);
        return w is null ? NotFound() : Ok(w);
    }

    [HttpPost("sets/{idOrSlug}/words/bulk")]
    public async Task<ActionResult<object>> BulkAdd(string idOrSlug, [FromBody] List<CreateWordRequest> items)
    {
        var userId = GetUserId();
        if (userId is null) return Unauthorized();
        var setId = await ResolveSetIdAsync(idOrSlug, userId.Value);
        if (setId is null) return NotFound();
        var count = await service.BulkAddAsync(setId.Value, new BulkAddWordsRequest(items), userId.Value);
        return count is null ? NotFound() : Ok(new { count });
    }

    [HttpPut("words/{id:guid}")]
    public async Task<ActionResult<WordResponse>> Update(Guid id, [FromBody] CreateWordRequest req)
    {
        var userId = GetUserId();
        if (userId is null) return Unauthorized();
        var w = await service.UpdateAsync(id, req, userId.Value);
        return w is null ? NotFound() : Ok(w);
    }

    [HttpDelete("words/{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var userId = GetUserId();
        if (userId is null) return Unauthorized();
        var ok = await service.DeleteAsync(id, userId.Value);
        return ok ? NoContent() : NotFound();
    }
}
