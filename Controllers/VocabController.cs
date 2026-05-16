using Api.DTOs.Requests;
using Api.DTOs.Responses;
using Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace Api.Controllers;

[Route("api/vocab")]
public class VocabController(VocabService service) : BaseController
{
    [HttpPost("save")]
    public async Task<ActionResult<WordResponse>> Save([FromBody] SaveToVocabRequest req)
    {
        var userId = GetUserId();
        if (userId is null) return Unauthorized();
        return Ok(await service.SaveAsync(req, userId.Value));
    }
}
