using HueGraphics.API.Attributes;
using HueGraphics.Application.Interfaces;
using HueGraphics.Core.Interfaces;
using Microsoft.AspNetCore.Mvc;

namespace HueGraphics.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class PointCloudController : ControllerBase
{
    private readonly IPointCloudService _pointCloudService;
    private readonly IModelUploadService _uploadService;
    private readonly IBackgroundProcessingService _backgroundProcessing;
    private readonly ICleanupService _cleanupService;
    private readonly ILogger<PointCloudController> _logger;

    public PointCloudController(
        IPointCloudService pointCloudService,
        IModelUploadService uploadService,
        IBackgroundProcessingService backgroundProcessing,
        ICleanupService cleanupService,
        ILogger<PointCloudController> logger)
    {
        _pointCloudService = pointCloudService;
        _uploadService = uploadService;
        _backgroundProcessing = backgroundProcessing;
        _cleanupService = cleanupService;
        _logger = logger;
    }

    /// <summary>
    /// Get list of all available point clouds
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> GetAllPointClouds()
    {
        var pointClouds = await _pointCloudService.GetAllPointCloudsAsync();
        return Ok(pointClouds);
    }

    /// <summary>
    /// Get metadata for a specific point cloud
    /// </summary>
    [HttpGet("{id}/metadata")]
    public async Task<IActionResult> GetMetadata(string id)
    {
        var metadata = await _pointCloudService.GetPointCloudMetadataAsync(id);

        if (metadata == null)
            return NotFound(new { message = $"Point cloud '{id}' not found" });

        return Ok(metadata);
    }

    /// <summary>
    /// Get full point cloud data (JSON format only)
    /// </summary>
    [HttpGet("{id}/data")]
    public async Task<IActionResult> GetPointCloudData(string id)
    {
        var pointCloud = await _pointCloudService.GetPointCloudDataAsync(id);

        if (pointCloud == null)
            return NotFound(new { message = $"Point cloud data '{id}' not found" });

        return Ok(pointCloud);
    }

    /// <summary>
    /// Get EPT metadata (for EPT format point clouds)
    /// </summary>
    [HttpGet("{id}/ept.json")]
    public async Task<IActionResult> GetEptMetadata(string id)
    {
        var eptMetadata = await _pointCloudService.GetEptMetadataAsync(id);

        if (eptMetadata == null)
            return NotFound(new { message = $"EPT metadata for '{id}' not found" });

        return Ok(eptMetadata);
    }

    /// <summary>
    /// Get EPT tile data (binary)
    /// </summary>
    [HttpGet("{id}/ept-data/{tile}")]
    public async Task<IActionResult> GetEptTile(string id, string tile)
    {
        var tileData = await _pointCloudService.GetEptTileAsync(id, tile);

        if (tileData == null)
            return NotFound(new { message = $"EPT tile '{tile}' not found for point cloud '{id}'" });

        return File(tileData, "application/octet-stream");
    }

    /// <summary>
    /// Get EPT hierarchy (JSON)
    /// </summary>
    [HttpGet("{id}/ept-hierarchy/{tile}")]
    public async Task<IActionResult> GetEptHierarchy(string id, string tile)
    {
        var hierarchy = await _pointCloudService.GetEptHierarchyAsync(id, tile);

        if (hierarchy == null)
            return NotFound(new { message = $"EPT hierarchy '{tile}' not found for point cloud '{id}'" });

        return Content(hierarchy, "application/json");
    }

    /// <summary>
    /// Upload a 3D model for processing (requires API key authentication)
    /// </summary>
    /// <param name="file">ZIP file containing 3D model</param>
    /// <param name="name">Model name (optional)</param>
    /// <param name="description">Model description (optional)</param>
    [HttpPost("upload")]
    [ApiKeyAuth]
    [RequestSizeLimit(104857600)] // 100 MB
    [RequestFormLimits(MultipartBodyLengthLimit = 104857600)] // 100 MB
    public async Task<IActionResult> Upload(
        IFormFile file,
        [FromForm] string? name = null,
        [FromForm] string? description = null)
    {
        try
        {
            _logger.LogInformation("Received upload request for file: {FileName}", file?.FileName);

            if (file == null)
                return BadRequest(new { message = "File is required" });

            var metadata = await _uploadService.ProcessUploadAsync(file, name, description, HttpContext.RequestAborted);

            _logger.LogInformation("Upload processed successfully: {ModelId}", metadata.Id);

            return Ok(new
            {
                success = true,
                message = "Model uploaded successfully and queued for processing",
                data = metadata
            });
        }
        catch (ArgumentException ex)
        {
            _logger.LogWarning(ex, "Upload validation failed");
            return BadRequest(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Upload processing failed");
            return StatusCode(500, new { message = "Failed to process upload", error = ex.Message });
        }
    }

    /// <summary>
    /// Get processing status for multiple models by GUID
    /// </summary>
    [HttpPost("status/bulk")]
    public IActionResult GetBulkProcessingStatus([FromBody] List<Guid> guids)
    {
        if (guids == null || guids.Count == 0)
        {
            return BadRequest(new { message = "At least one GUID is required" });
        }

        var statuses = _backgroundProcessing.GetBulkProcessingStatus(guids);

        return Ok(new
        {
            success = true,
            data = statuses
        });
    }

    /// <summary>
    /// Get processing status for a model
    /// </summary>
    [HttpGet("{id}/status")]
    public IActionResult GetProcessingStatus(string id)
    {
        var status = _backgroundProcessing.GetProcessingStatus(id);

        if (status == null)
        {
            return NotFound(new { message = $"No processing status found for model '{id}'" });
        }

        return Ok(new
        {
            success = true,
            data = status
        });
    }

    /// <summary>
    /// Manually trigger cleanup operation (requires API key authentication)
    /// </summary>
    [HttpPost("cleanup")]
    [ApiKeyAuth]
    public async Task<IActionResult> TriggerCleanup()
    {
        try
        {
            _logger.LogInformation("Manual cleanup triggered via API");
            await _cleanupService.PerformCleanupAsync(HttpContext.RequestAborted);

            return Ok(new
            {
                success = true,
                message = "Cleanup operation completed successfully"
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Manual cleanup failed");
            return StatusCode(500, new { message = "Cleanup operation failed", error = ex.Message });
        }
    }
}
