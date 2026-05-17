using Api.DTOs.Requests;
using Api.DTOs.Responses;
using Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace Api.Controllers;

[Route("api/ai")]
[EnableRateLimiting("ai")]
public class AiController(AiService service) : BaseController
{
    [HttpPost("generate-text")]
    public async Task<ActionResult<GeneratedTextResponse>> GenerateText([FromBody] GenerateTextRequest req)
    {
        var userId = GetUserId();
        if (userId is null) return Unauthorized();
        try
        {
            var result = await service.GenerateTextAsync(req, userId.Value);
            return result is null ? NotFound() : Ok(result);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpGet("usage")]
    public async Task<ActionResult<object>> Usage()
    {
        var userId = GetUserId();
        if (userId is null) return Unauthorized();
        var (generate, translate) = await service.GetRemainingTodayAsync(userId.Value);
        return Ok(new { generateRemaining = generate, translateRemaining = translate, remaining = generate });
    }

    [HttpPost("translate")]
    public async Task<ActionResult<DTOs.Responses.TranslateResponse>> Translate([FromBody] DTOs.Requests.TranslateRequest req)
    {
        var userId = GetUserId();
        if (userId is null) return Unauthorized();
        if (string.IsNullOrWhiteSpace(req.Text)) return BadRequest(new { error = "Empty text" });
        try
        {
            var translation = await service.TranslateAsync(req.Text, userId.Value);
            return translation is null ? NotFound() : Ok(new DTOs.Responses.TranslateResponse(translation));
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }
}
