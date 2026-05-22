using Api.DTOs.Responses;
using Api.Models;

namespace Api.Mappings;

public static class WordSetMapper
{
    public static WordSetResponse ToResponse(this WordSet s, Guid currentUserId, int wordCount, ProgressStatus status = ProgressStatus.NotStarted, bool isFavorite = false) =>
        new(
            s.Id,
            s.Slug,
            s.WeekId,
            s.Week?.Number,
            s.Name,
            s.Description,
            s.Level,
            s.IsPublic,
            s.IsOfficial,
            s.CreatedByUserId == currentUserId,
            isFavorite,
            wordCount,
            status.ToString(),
            s.IsOfficial ? null : s.CreatedByUserId,
            s.IsOfficial ? null : (s.CreatedByUser?.DisplayName ?? s.CreatedByUser?.Email),
            s.CreatedAt
        );

    public static WordResponse ToResponse(this Word w) =>
        new(w.Id, w.WordSetId, w.Front, w.Back, w.Context, w.DisplayOrder, w.CreatedAt);
}
