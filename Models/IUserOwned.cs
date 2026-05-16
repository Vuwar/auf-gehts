namespace Api.Models;

public interface IUserOwned
{
    Guid Id { get; set; }
    Guid UserId { get; set; }
}
