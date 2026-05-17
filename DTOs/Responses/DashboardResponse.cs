namespace Api.DTOs.Responses;

public record DashboardResponse(
    StatsResponse Stats,
    List<WeekResponse> Weeks,
    int CurrentStreak,
    int LongestStreak,
    List<FriendProgressResponse> Friends
);
