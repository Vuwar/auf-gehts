using Api.DTOs.Requests;
using Api.DTOs.Responses;
using Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.OutputCaching;

namespace Api.Controllers;

[Route("api/friends")]
public class FriendsController(FriendshipService friendship, UserProfileService profile) : BaseController
{
    [HttpGet]
    [OutputCache(PolicyName = "PerUser")]
    public async Task<ActionResult<List<FriendSummaryResponse>>> List()
    {
        var userId = GetUserId();
        if (userId is null) return Unauthorized();
        return Ok(await profile.ListFriendsAsync(userId.Value));
    }

    [HttpGet("requests")]
    public async Task<ActionResult<PendingRequestsResponse>> ListRequests()
    {
        var userId = GetUserId();
        if (userId is null) return Unauthorized();
        return Ok(await profile.ListRequestsAsync(userId.Value));
    }

    [HttpGet("requests/count")]
    public async Task<ActionResult<IncomingCountResponse>> RequestCount(
        [FromServices] Api.Repositories.IFriendshipRepository friendships)
    {
        var userId = GetUserId();
        if (userId is null) return Unauthorized();
        var count = await friendships.CountIncomingPendingAsync(userId.Value);
        return Ok(new IncomingCountResponse(count));
    }

    [HttpPost("requests")]
    public async Task<IActionResult> CreateRequest([FromBody] CreateFriendRequestRequest req)
    {
        var userId = GetUserId();
        if (userId is null) return Unauthorized();

        var result = await friendship.SendRequestAsync(userId.Value, req.AddresseeId);
        return result.Outcome switch
        {
            FriendRequestOutcome.Created or
            FriendRequestOutcome.ResubmittedAfterDecline =>
                StatusCode(StatusCodes.Status201Created, new { id = result.Friendship!.Id, status = "pending" }),
            FriendRequestOutcome.AutoAcceptedFromReverse =>
                Ok(new { id = result.Friendship!.Id, status = "accepted" }),
            FriendRequestOutcome.AlreadyPending => Conflict(new { error = "Request already pending" }),
            FriendRequestOutcome.AlreadyFriends => Conflict(new { error = "Already friends" }),
            FriendRequestOutcome.SelfRejected => BadRequest(new { error = "Cannot friend yourself" }),
            FriendRequestOutcome.AddresseeMissing => NotFound(new { error = "User not found" }),
            _ => StatusCode(StatusCodes.Status500InternalServerError),
        };
    }

    [HttpPost("requests/{id:guid}/accept")]
    public async Task<IActionResult> Accept(Guid id)
    {
        var userId = GetUserId();
        if (userId is null) return Unauthorized();
        return Map(await friendship.AcceptAsync(id, userId.Value));
    }

    [HttpPost("requests/{id:guid}/decline")]
    public async Task<IActionResult> Decline(Guid id)
    {
        var userId = GetUserId();
        if (userId is null) return Unauthorized();
        return Map(await friendship.DeclineAsync(id, userId.Value));
    }

    [HttpDelete("requests/{id:guid}")]
    public async Task<IActionResult> Cancel(Guid id)
    {
        var userId = GetUserId();
        if (userId is null) return Unauthorized();
        return Map(await friendship.CancelAsync(id, userId.Value));
    }

    [HttpDelete("{otherUserId:guid}")]
    public async Task<IActionResult> Unfriend(Guid otherUserId)
    {
        var userId = GetUserId();
        if (userId is null) return Unauthorized();
        var ok = await friendship.UnfriendAsync(userId.Value, otherUserId);
        return ok ? NoContent() : NotFound(new { error = "Not friends" });
    }

    private IActionResult Map(FriendActionOutcome outcome) => outcome switch
    {
        FriendActionOutcome.Ok => NoContent(),
        FriendActionOutcome.NotFound => NotFound(),
        FriendActionOutcome.NotAuthorized => Forbid(),
        FriendActionOutcome.NotPending => Conflict(new { error = "Request is not pending" }),
        _ => StatusCode(StatusCodes.Status500InternalServerError),
    };
}
