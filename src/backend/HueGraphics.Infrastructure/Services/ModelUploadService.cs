using HueGraphics.Application.Interfaces;
using HueGraphics.Core.Models;
using HueGraphics.Domain.Settings;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace HueGraphics.Infrastructure.Services;

public class ModelUploadService : IModelUploadService
{
    private readonly UploadSettings _uploadSettings;
    private readonly PointCloudSettings _pointCloudSettings;
    private readonly IBackgroundProcessingService _backgroundProcessing;
    private readonly ILogger<ModelUploadService> _logger;

    public ModelUploadService(
        IOptions<UploadSettings> uploadSettings,
        IOptions<PointCloudSettings> pointCloudSettings,
        IBackgroundProcessingService backgroundProcessing,
        ILogger<ModelUploadService> logger)
    {
        _uploadSettings = uploadSettings.Value;
        _pointCloudSettings = pointCloudSettings.Value;
        _backgroundProcessing = backgroundProcessing;
        _logger = logger;
    }

    public async Task<PointCloudMetadata> ProcessUploadAsync(
        IFormFile file,
        string? name,
        string? description,
        CancellationToken cancellationToken = default)
    {
        // Validate file
        ValidateFile(file);

        // Generate unique ID for this model
        var modelId = GenerateModelId(name ?? file.FileName);

        // Create uploads directory if it doesn't exist
        var uploadsDir = Path.Combine(_uploadSettings.UploadPath);
        Directory.CreateDirectory(uploadsDir);

        // Save uploaded zip file to persistent location
        var zipPath = Path.Combine(uploadsDir, $"{modelId}.zip");
        await using (var stream = new FileStream(zipPath, FileMode.Create))
        {
            await file.CopyToAsync(stream, cancellationToken);
        }

        _logger.LogInformation("Uploaded file saved for model {ModelId}, queuing for background processing", modelId);

        // Queue for background processing
        _backgroundProcessing.QueueModelProcessing(modelId, zipPath, name, description);

        // Return metadata with pending status
        var metadata = new PointCloudMetadata
        {
            Id = modelId,
            Name = name ?? Path.GetFileNameWithoutExtension(file.FileName),
            Description = description,
            SourceFile = file.FileName,
            Format = PointCloudFormat.ept,
            CreatedAt = DateTime.UtcNow
        };

        return metadata;
    }

    private void ValidateFile(IFormFile file)
    {
        if (file == null || file.Length == 0)
        {
            throw new ArgumentException("File is required");
        }

        var extension = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (!_uploadSettings.AllowedExtensions.Contains(extension))
        {
            throw new ArgumentException($"File type {extension} is not allowed");
        }

        var maxSizeBytes = _uploadSettings.MaxFileSizeMB * 1024 * 1024;
        if (file.Length > maxSizeBytes)
        {
            throw new ArgumentException($"File size exceeds maximum of {_uploadSettings.MaxFileSizeMB}MB");
        }
    }

    private string GenerateModelId(string fileName)
    {
        var baseName = Path.GetFileNameWithoutExtension(fileName)
            .ToLowerInvariant()
            .Replace(" ", "-")
            .Replace("_", "-");

        // Remove special characters
        baseName = new string(baseName.Where(c => char.IsLetterOrDigit(c) || c == '-').ToArray());

        // Add timestamp to ensure uniqueness
        var timestamp = DateTime.UtcNow.ToString("yyyyMMddHHmmss");

        return $"{baseName}-{timestamp}";
    }

}
