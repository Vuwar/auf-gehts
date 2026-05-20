using Api.DTOs.Requests;
using Api.DTOs.Responses;
using Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace Api.Controllers;

[Route("api")]
public class TagsController(TagService service) : BaseController
{
    [HttpGet("weeks/{weekId:guid}/tags")]
    public async Task<ActionResult<List<TagResponse>>> ListForWeek(Guid weekId)
    {
        var userId = GetUserId();
        if (userId is null) return Unauthorized();
        return Ok(await service.ListAsync(weekId, userId.Value));
    }

    [HttpPost("weeks/{weekId:guid}/tags")]
    public async Task<ActionResult<object>> Create(Guid weekId, [FromBody] CreateTagRequest req)
    {
        var (tag, error) = await service.CreateAsync(weekId, req);
        if (tag is null) return BadRequest(new { error });
        return Ok(new { id = tag.Id, weekId = tag.WeekId, tagNumber = tag.TagNumber, name = tag.Name, wordSetId = tag.WordSetId, readingTextId = tag.ReadingTextId });
    }

    [HttpGet("tags/{id:guid}")]
    public async Task<ActionResult<TagDetailResponse>> Get(Guid id)
    {
        var userId = GetUserId();
        if (userId is null) return Unauthorized();
        var resp = await service.GetDetailAsync(id, userId.Value);
        return resp is null ? NotFound() : Ok(resp);
    }

    [HttpPut("tags/{id:guid}")]
    public async Task<ActionResult<object>> Update(Guid id, [FromBody] UpdateTagRequest req)
    {
        var (tag, error) = await service.UpdateAsync(id, req);
        if (tag is null) return BadRequest(new { error });
        return Ok(new { id = tag.Id, tagNumber = tag.TagNumber, name = tag.Name, wordSetId = tag.WordSetId, readingTextId = tag.ReadingTextId });
    }

    [HttpDelete("tags/{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var ok = await service.DeleteAsync(id);
        return ok ? NoContent() : Forbid();
    }

    [HttpPost("tags/{id:guid}/progress")]
    public async Task<ActionResult<object>> CompleteStep(Guid id, [FromBody] TagProgressUpdateRequest req)
    {
        var userId = GetUserId();
        if (userId is null) return Unauthorized();
        var p = await service.CompleteStepAsync(id, userId.Value, req.StepIndex);
        if (p is null) return BadRequest(new { error = "Step not recorded (locked or invalid)" });
        return Ok(new { completedStepsMask = p.CompletedStepsMask, lastStep = p.LastStep, isCompleted = p.CompletedAt != null });
    }

    [HttpPost("tags/{id:guid}/generate-passage")]
    [EnableRateLimiting("ai")]
    public async Task<ActionResult<GeneratedTagPassageResponse>> GeneratePassage(Guid id, [FromBody] GenerateTagPassageRequest req)
    {
        var userId = GetUserId();
        if (userId is null) return Unauthorized();
        try
        {
            var resp = await service.GeneratePassageAsync(id, req, userId.Value);
            return Ok(resp);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }
}
