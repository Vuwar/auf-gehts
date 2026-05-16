using Api.DTOs.Responses;
using Api.Models;

namespace Api.Mappings;

public static class WordSetMapper
{
    public static WordSetResponse ToResponse(this WordSet s, Guid currentUserId, int wordCount, ProgressStatus status = ProgressStatus.NotStarted) =>
        new(
            s.Id,
            s.Slug,
            s.WeekId,
            s.Week?.Number,
            s.Name,
            s.Description,
            s.Level,
            s.IsPublic,
            s.OwnerUserId == currentUserId,
            wordCount,
            status.ToString(),
            s.CreatedAt
        );

    public static WordResponse ToResponse(this Word w) =>
        new(w.Id, w.WordSetId, w.Front, w.Back, w.Context, w.DisplayOrder, w.CreatedAt);
}
