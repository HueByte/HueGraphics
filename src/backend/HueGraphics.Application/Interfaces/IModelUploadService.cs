using HueGraphics.Core.Models;
using Microsoft.AspNetCore.Http;

namespace HueGraphics.Application.Interfaces;

public interface IModelUploadService
{
    Task<PointCloudMetadata> ProcessUploadAsync(
        IFormFile file,
        string? name,
        string? description,
        CancellationToken cancellationToken = default);
}
