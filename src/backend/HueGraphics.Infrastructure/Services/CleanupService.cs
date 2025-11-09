using System.Text.Json;
using HueGraphics.Application.Interfaces;
using HueGraphics.Core.Models;
using HueGraphics.Domain.Settings;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace HueGraphics.Infrastructure.Services;

public class CleanupService : ICleanupService
{
    private readonly ILogger<CleanupService> _logger;
    private readonly PointCloudSettings _pointCloudSettings;
    private readonly string _uploadPath;

    public CleanupService(
        ILogger<CleanupService> logger,
        IOptions<PointCloudSettings> pointCloudSettings)
    {
        _logger = logger;
        _pointCloudSettings = pointCloudSettings.Value;
        _uploadPath = Path.Combine(Path.GetTempPath(), "HueGraphics_Uploads");
    }

    public async Task PerformCleanupAsync(CancellationToken cancellationToken = default)
    {
        _logger.LogInformation("Starting scheduled cleanup operation");

        try
        {
            await RemoveOrphanedFilesAsync(cancellationToken);
            await ValidateAndFixMetadataAsync(cancellationToken);

            _logger.LogInformation("Cleanup operation completed successfully");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error during cleanup operation");
        }
    }

    public async Task RemoveOrphanedFilesAsync(CancellationToken cancellationToken = default)
    {
        _logger.LogInformation("Checking for orphaned files");

        // Remove old zip files from upload directory (older than 1 hour)
        await RemoveOldZipFilesAsync(cancellationToken);

        // Remove orphaned point cloud directories (no metadata or incomplete data)
        await RemoveOrphanedPointCloudDirectoriesAsync(cancellationToken);
    }

    public async Task ValidateAndFixMetadataAsync(CancellationToken cancellationToken = default)
    {
        _logger.LogInformation("Validating point cloud metadata");

        if (!Directory.Exists(_pointCloudSettings.DataPath))
        {
            _logger.LogWarning("Point cloud data path does not exist: {DataPath}", _pointCloudSettings.DataPath);
            return;
        }

        var directories = Directory.GetDirectories(_pointCloudSettings.DataPath);
        var fixedCount = 0;
        var invalidCount = 0;

        foreach (var dir in directories)
        {
            if (cancellationToken.IsCancellationRequested)
                break;

            var modelId = Path.GetFileName(dir);
            var metadataPath = Path.Combine(dir, "metadata.json");

            try
            {
                if (!File.Exists(metadataPath))
                {
                    _logger.LogWarning("Missing metadata.json for model {ModelId}, attempting to create", modelId);
                    await TryCreateMetadataAsync(dir, modelId, cancellationToken);
                    fixedCount++;
                    continue;
                }

                // Validate existing metadata
                var metadataJson = await File.ReadAllTextAsync(metadataPath, cancellationToken);
                var metadata = JsonSerializer.Deserialize<PointCloudMetadata>(metadataJson);

                if (metadata == null)
                {
                    _logger.LogWarning("Failed to deserialize metadata for model {ModelId}", modelId);
                    invalidCount++;
                    continue;
                }

                bool needsUpdate = false;

                // Check for missing GUID
                if (metadata.Guid == Guid.Empty)
                {
                    _logger.LogWarning("Model {ModelId} has no GUID, generating new one", modelId);
                    metadata.Guid = Guid.NewGuid();
                    needsUpdate = true;
                }

                // Check for missing ID
                if (string.IsNullOrEmpty(metadata.Id))
                {
                    _logger.LogWarning("Model {ModelId} has no ID, setting to directory name", modelId);
                    metadata.Id = modelId;
                    needsUpdate = true;
                }

                // Check for missing required fields
                if (string.IsNullOrEmpty(metadata.SourceFile))
                {
                    _logger.LogWarning("Model {ModelId} has no source file, attempting to detect", modelId);
                    metadata.SourceFile = DetectSourceFile(dir) ?? "unknown";
                    needsUpdate = true;
                }

                // Validate format
                if (metadata.Format == default)
                {
                    _logger.LogWarning("Model {ModelId} has invalid format, setting to EPT", modelId);
                    metadata.Format = PointCloudFormat.ept;
                    needsUpdate = true;
                }

                // Validate EPT data exists
                var eptJsonPath = Path.Combine(dir, "ept.json");
                if (!File.Exists(eptJsonPath))
                {
                    _logger.LogWarning("Model {ModelId} missing ept.json, point cloud may be corrupted", modelId);
                    invalidCount++;
                }

                // Update metadata if needed
                if (needsUpdate)
                {
                    var updatedJson = JsonSerializer.Serialize(metadata, new JsonSerializerOptions
                    {
                        WriteIndented = true
                    });
                    await File.WriteAllTextAsync(metadataPath, updatedJson, cancellationToken);
                    _logger.LogInformation("Fixed metadata for model {ModelId}", modelId);
                    fixedCount++;
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error validating metadata for model {ModelId}", modelId);
                invalidCount++;
            }
        }

        if (fixedCount > 0)
        {
            _logger.LogInformation("Fixed {Count} metadata files", fixedCount);
        }

        if (invalidCount > 0)
        {
            _logger.LogWarning("Found {Count} invalid or corrupted point cloud directories", invalidCount);
        }
    }

    private async Task RemoveOldZipFilesAsync(CancellationToken cancellationToken)
    {
        if (!Directory.Exists(_uploadPath))
            return;

        var cutoffTime = DateTime.UtcNow.AddHours(-1);
        var zipFiles = Directory.GetFiles(_uploadPath, "*.zip");
        var removedCount = 0;

        foreach (var zipFile in zipFiles)
        {
            if (cancellationToken.IsCancellationRequested)
                break;

            try
            {
                var fileInfo = new FileInfo(zipFile);
                if (fileInfo.LastWriteTimeUtc < cutoffTime)
                {
                    File.Delete(zipFile);
                    _logger.LogInformation("Removed old zip file: {FileName}", Path.GetFileName(zipFile));
                    removedCount++;
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to delete old zip file: {FileName}", Path.GetFileName(zipFile));
            }
        }

        if (removedCount > 0)
        {
            _logger.LogInformation("Removed {Count} old zip files", removedCount);
        }
    }

    private async Task RemoveOrphanedPointCloudDirectoriesAsync(CancellationToken cancellationToken)
    {
        if (!Directory.Exists(_pointCloudSettings.DataPath))
            return;

        var directories = Directory.GetDirectories(_pointCloudSettings.DataPath);
        var removedCount = 0;

        foreach (var dir in directories)
        {
            if (cancellationToken.IsCancellationRequested)
                break;

            var modelId = Path.GetFileName(dir);
            var metadataPath = Path.Combine(dir, "metadata.json");
            var eptJsonPath = Path.Combine(dir, "ept.json");

            try
            {
                // Check if directory is orphaned (no metadata AND no ept.json)
                if (!File.Exists(metadataPath) && !File.Exists(eptJsonPath))
                {
                    _logger.LogWarning("Removing orphaned directory for model {ModelId} (no metadata or ept.json)", modelId);
                    Directory.Delete(dir, true);
                    removedCount++;
                    continue;
                }

                // Check if directory is very old and incomplete
                var dirInfo = new DirectoryInfo(dir);
                var cutoffTime = DateTime.UtcNow.AddDays(-7);

                if (dirInfo.LastWriteTimeUtc < cutoffTime && !File.Exists(eptJsonPath))
                {
                    _logger.LogWarning("Removing old incomplete directory for model {ModelId} (no ept.json, older than 7 days)", modelId);
                    Directory.Delete(dir, true);
                    removedCount++;
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to process directory for model {ModelId}", modelId);
            }
        }

        if (removedCount > 0)
        {
            _logger.LogInformation("Removed {Count} orphaned point cloud directories", removedCount);
        }
    }

    private async Task TryCreateMetadataAsync(string directory, string modelId, CancellationToken cancellationToken)
    {
        try
        {
            var eptJsonPath = Path.Combine(directory, "ept.json");

            // Only create metadata if ept.json exists (meaning processing completed)
            if (!File.Exists(eptJsonPath))
            {
                _logger.LogWarning("Cannot create metadata for {ModelId} - ept.json does not exist", modelId);
                return;
            }

            var metadata = new PointCloudMetadata
            {
                Guid = Guid.NewGuid(),
                Id = modelId,
                Name = modelId,
                SourceFile = DetectSourceFile(directory) ?? "unknown",
                Format = PointCloudFormat.ept,
                CreatedAt = DateTime.UtcNow
            };

            var metadataPath = Path.Combine(directory, "metadata.json");
            var metadataJson = JsonSerializer.Serialize(metadata, new JsonSerializerOptions
            {
                WriteIndented = true
            });

            await File.WriteAllTextAsync(metadataPath, metadataJson, cancellationToken);
            _logger.LogInformation("Created metadata for model {ModelId}", modelId);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to create metadata for model {ModelId}", modelId);
        }
    }

    private string? DetectSourceFile(string directory)
    {
        // Try to find any model file in the directory
        var supportedExtensions = new[] { ".gltf", ".glb", ".obj", ".fbx", ".ply" };

        foreach (var ext in supportedExtensions)
        {
            var files = Directory.GetFiles(directory, $"*{ext}", SearchOption.TopDirectoryOnly);
            if (files.Length > 0)
            {
                return Path.GetFileName(files[0]);
            }
        }

        return null;
    }
}
