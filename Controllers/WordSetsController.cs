using Api.DTOs.Requests;
using Api.DTOs.Responses;
using Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace Api.Controllers;

[Route("api/sets")]
public class WordSetsController(WordSetService service) : BaseController
{
    [HttpGet("library")]
    public async Task<ActionResult<LibraryResponse>> Library()
    {
        var userId = GetUserId();
        if (userId is null) return Unauthorized();
        return Ok(await service.ListForLibraryAsync(userId.Value));
    }

    [HttpGet("{idOrSlug}")]
    public async Task<ActionResult<WordSetResponse>> Get(string idOrSlug)
    {
        var userId = GetUserId();
        if (userId is null) return Unauthorized();
        var set = Guid.TryParse(idOrSlug, out var id)
            ? await service.GetAsync(id, userId.Value)
            : await service.GetBySlugAsync(idOrSlug, userId.Value);
        return set is null ? NotFound() : Ok(set);
    }

    [HttpPost]
    public async Task<ActionResult<WordSetResponse>> Create([FromBody] CreateWordSetRequest req)
    {
        var userId = GetUserId();
        if (userId is null) return Unauthorized();
        return Ok(await service.CreateAsync(req, userId.Value));
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var userId = GetUserId();
        if (userId is null) return Unauthorized();
        var ok = await service.DeleteAsync(id, userId.Value);
        return ok ? NoContent() : NotFound();
    }
}
