using HueGraphics.Core.Interfaces;
using Microsoft.AspNetCore.Mvc;

namespace HueGraphics.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class PointCloudController : ControllerBase
{
    private readonly IPointCloudService _pointCloudService;
    private readonly ILogger<PointCloudController> _logger;

    public PointCloudController(
        IPointCloudService pointCloudService,
        ILogger<PointCloudController> logger)
    {
        _pointCloudService = pointCloudService;
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
}
