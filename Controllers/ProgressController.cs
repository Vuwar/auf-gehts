using Api.DTOs.Requests;
using Api.Models;
using Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace Api.Controllers;

[Route("api/sets/{idOrSlug}")]
public class ProgressController(ProgressService service, WordSetService setService) : BaseController
{
    [HttpPut("progress")]
    public async Task<IActionResult> SetProgress(string idOrSlug, [FromBody] UpdateProgressRequest req)
    {
        var userId = GetUserId();
        if (userId is null) return Unauthorized();
        if (!Enum.TryParse<ProgressStatus>(req.Status, true, out var status)) return BadRequest("invalid status");
        var set = await setService.ResolveAsync(idOrSlug, userId.Value);
        if (set is null) return NotFound();
        await service.SetStatusAsync(userId.Value, set.Id, status);
        return NoContent();
    }

    [HttpPut("favorite")]
    public async Task<IActionResult> SetFavorite(string idOrSlug, [FromBody] SetFavoriteRequest req)
    {
        var userId = GetUserId();
        if (userId is null) return Unauthorized();
        var set = await setService.ResolveAsync(idOrSlug, userId.Value);
        if (set is null) return NotFound();
        await service.SetFavoriteAsync(userId.Value, set.Id, req.IsFavorite);
        return NoContent();
    }
}

public record SetFavoriteRequest(bool IsFavorite);
