using Api.DTOs.Requests;
using Api.Models;
using Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace Api.Controllers;

[Route("api/sets/{idOrSlug}/progress")]
public class ProgressController(ProgressService service, WordSetService setService) : BaseController
{
    [HttpPut]
    public async Task<IActionResult> Set(string idOrSlug, [FromBody] UpdateProgressRequest req)
    {
        var userId = GetUserId();
        if (userId is null) return Unauthorized();
        if (!Enum.TryParse<ProgressStatus>(req.Status, true, out var status)) return BadRequest("invalid status");
        var set = await setService.ResolveAsync(idOrSlug, userId.Value);
        if (set is null) return NotFound();
        await service.SetStatusAsync(userId.Value, set.Id, status);
        return NoContent();
    }
}
