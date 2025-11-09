namespace HueGraphics.Application.Interfaces;

public interface ICleanupService
{
    /// <summary>
    /// Performs cleanup operations including:
    /// - Removing orphaned zip files
    /// - Removing incomplete/corrupted point cloud data
    /// - Validating metadata consistency
    /// - Attempting to fix corrupted metadata
    /// </summary>
    Task PerformCleanupAsync(CancellationToken cancellationToken = default);

    /// <summary>
    /// Validates and fixes point cloud metadata
    /// </summary>
    Task ValidateAndFixMetadataAsync(CancellationToken cancellationToken = default);

    /// <summary>
    /// Removes old temporary files and orphaned data
    /// </summary>
    Task RemoveOrphanedFilesAsync(CancellationToken cancellationToken = default);
}
