using Api.DTOs.Requests;
using Api.DTOs.Responses;
using Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace Api.Controllers;

[Route("api/reading-texts")]
public class ReadingTextsController(ReadingTextService service, AiService ai) : BaseController
{
    private const long MaxAudioBytes = 5 * 1024 * 1024;
    private static readonly HashSet<string> AllowedAudioTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav", "audio/wave",
    };

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

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<ReadingTextResponse>> Update(Guid id, [FromBody] UpdateReadingTextRequest req)
    {
        var userId = GetUserId();
        if (userId is null) return Unauthorized();
        var t = await service.UpdateAsync(id, req, userId.Value);
        return t is null ? NotFound() : Ok(t);
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

    [HttpPost("{id:guid}/audio/generate")]
    public async Task<ActionResult<ReadingTextResponse>> RegenerateAudio(Guid id)
    {
        var userId = GetUserId();
        if (userId is null) return Unauthorized();
        var t = await service.RegenerateAudioAsync(id, userId.Value);
        return t is null ? NotFound() : Ok(t);
    }

    [HttpPost("{id:guid}/audio")]
    [Consumes("multipart/form-data")]
    [RequestSizeLimit(MaxAudioBytes + 4096)]
    public async Task<ActionResult<ReadingTextResponse>> UploadAudio(Guid id, [FromForm] IFormFile? file)
    {
        var userId = GetUserId();
        if (userId is null) return Unauthorized();
        if (file is null || file.Length == 0) return BadRequest(new { error = "No file provided" });
        if (file.Length > MaxAudioBytes) return BadRequest(new { error = "File too large (max 5 MB)" });
        if (string.IsNullOrEmpty(file.ContentType) || !AllowedAudioTypes.Contains(file.ContentType))
            return BadRequest(new { error = "Unsupported audio content type" });

        using var ms = new MemoryStream();
        await file.CopyToAsync(ms);
        var contentType = file.ContentType.Equals("audio/mp3", StringComparison.OrdinalIgnoreCase)
            ? "audio/mpeg"
            : file.ContentType;
        var t = await service.ReplaceAudioAsync(id, userId.Value, ms.ToArray(), contentType);
        return t is null ? NotFound() : Ok(t);
    }

    [HttpDelete("{id:guid}/audio")]
    public async Task<IActionResult> DeleteAudio(Guid id)
    {
        var userId = GetUserId();
        if (userId is null) return Unauthorized();
        var ok = await service.DeleteAudioAsync(id, userId.Value);
        return ok ? NoContent() : NotFound();
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
