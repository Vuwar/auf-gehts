using Api.DTOs.Requests;
using Api.DTOs.Responses;
using Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace Api.Controllers;

[Route("api/reading-texts")]
public class ReadingTextsController(ReadingTextService service) : BaseController
{
    [HttpGet]
    public async Task<ActionResult<List<ReadingTextResponse>>> List()
    {
        var userId = GetUserId();
        if (userId is null) return Unauthorized();
        return Ok(await service.ListAsync(userId.Value));
    }

    [HttpPost]
    public async Task<ActionResult<ReadingTextResponse>> Create([FromBody] CreateReadingTextRequest req)
    {
        var userId = GetUserId();
        if (userId is null) return Unauthorized();
        var t = await service.CreateAsync(req, userId.Value);
        return t is null ? Forbid() : Ok(t);
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
