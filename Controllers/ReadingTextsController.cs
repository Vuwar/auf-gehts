using Api.DTOs.Requests;
using Api.DTOs.Responses;
using Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace Api.Controllers;

[Route("api/reading-texts")]
public class ReadingTextsController(ReadingTextService service, AiService ai) : BaseController
{
    [HttpGet]
    public async Task<ActionResult<List<ReadingTextResponse>>> List()
    {
        var userId = GetUserId();
        if (userId is null) return Unauthorized();
        return Ok(await service.ListAsync(userId.Value));
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<ReadingTextResponse>> Get(Guid id)
    {
        var userId = GetUserId();
        if (userId is null) return Unauthorized();
        var t = await service.GetAsync(id, userId.Value);
        return t is null ? NotFound() : Ok(t);
    }

    [HttpPost]
    public async Task<ActionResult<ReadingTextResponse>> Create([FromBody] CreateReadingTextRequest req)
    {
        var userId = GetUserId();
        if (userId is null) return Unauthorized();
        var t = await service.CreateAsync(req, userId.Value);
        return t is null ? Forbid() : Ok(t);
    }

    [HttpPost("generate-questions")]
    [EnableRateLimiting("ai")]
    public async Task<ActionResult<GeneratedQuestionsResponse>> GenerateQuestions([FromBody] GenerateQuestionsRequest req)
    {
        var userId = GetUserId();
        if (userId is null) return Unauthorized();
        if (string.IsNullOrWhiteSpace(req.Content)) return BadRequest(new { error = "Empty content" });
        try
        {
            var qs = await ai.GenerateQuestionsAsync(req.Content, req.Level, req.Count, userId.Value);
            return Ok(new GeneratedQuestionsResponse(qs));
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
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
