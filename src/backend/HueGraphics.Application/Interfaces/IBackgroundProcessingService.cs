using HueGraphics.Core.Models;

namespace HueGraphics.Application.Interfaces;

public interface IBackgroundProcessingService
{
    void QueueModelProcessing(string modelId, string zipPath, string? name, string? description);
    ProcessingStatus? GetProcessingStatus(string modelId);
}
