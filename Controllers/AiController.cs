using Api.DTOs.Requests;
using Api.DTOs.Responses;
using Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace Api.Controllers;

[Route("api/ai")]
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
        var remaining = await service.GetRemainingTodayAsync(userId.Value);
        return Ok(new { remaining });
    }
}
