using Api.DTOs.Responses;
using Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace Api.Controllers;

[Route("api/dictionary")]
public class DictionaryController(DictionaryService service) : BaseController
{
    [HttpGet("{word}")]
    public async Task<ActionResult<WordLookupResponse>> Lookup(string word)
    {
        var result = await service.LookupAsync(word);
        return result is null ? NotFound() : Ok(result);
    }
}
