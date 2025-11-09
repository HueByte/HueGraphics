using HueGraphics.Core.Models;

namespace HueGraphics.Application.Interfaces;

public interface IBackgroundProcessingService
{
    void QueueModelProcessing(string modelId, string zipPath, string? name, string? description, Guid guid);
    ProcessingStatus? GetProcessingStatus(string modelId);
    Dictionary<Guid, ProcessingStatus> GetBulkProcessingStatus(List<Guid> guids);
}
