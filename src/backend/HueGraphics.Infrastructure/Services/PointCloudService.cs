using System.Text.Json;
using HueGraphics.Core.Interfaces;
using HueGraphics.Core.Models;
using HueGraphics.Domain.Settings;
using Microsoft.Extensions.Options;

namespace HueGraphics.Infrastructure.Services;

public class PointCloudService : IPointCloudService
{
    private readonly PointCloudSettings _settings;
    private readonly string _dataPath;

    public PointCloudService(IOptions<PointCloudSettings> settings)
    {
        _settings = settings.Value;
        _dataPath = _settings.DataPath;

        if (!Directory.Exists(_dataPath))
        {
            Directory.CreateDirectory(_dataPath);
        }
    }

    public async Task<IEnumerable<PointCloudMetadata>> GetAllPointCloudsAsync()
    {
        var metadataList = new List<PointCloudMetadata>();

        if (!Directory.Exists(_dataPath))
            return metadataList;

        var subdirectories = Directory.GetDirectories(_dataPath);

        foreach (var dir in subdirectories)
        {
            var id = Path.GetFileName(dir);
            var metadata = await GetPointCloudMetadataAsync(id);
            if (metadata != null)
            {
                metadataList.Add(metadata);
            }
        }

        return metadataList;
    }

    public async Task<PointCloudMetadata?> GetPointCloudMetadataAsync(string id)
    {
        var pointCloudDir = Path.Combine(_dataPath, id);

        if (!Directory.Exists(pointCloudDir))
            return null;

        // Check for EPT format
        var eptMetadataPath = Path.Combine(pointCloudDir, "ept.json");
        if (File.Exists(eptMetadataPath))
        {
            var eptJson = await File.ReadAllTextAsync(eptMetadataPath);
            var eptMetadata = JsonSerializer.Deserialize<EptMetadata>(eptJson, new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true
            });

            if (eptMetadata != null)
            {
                return new PointCloudMetadata
                {
                    Id = id,
                    SourceFile = id,
                    PointCount = (int)eptMetadata.Points,
                    BoundsMin = [
                        (float)eptMetadata.Bounds[0],
                        (float)eptMetadata.Bounds[1],
                        (float)eptMetadata.Bounds[2]
                    ],
                    BoundsMax = [
                        (float)eptMetadata.Bounds[3],
                        (float)eptMetadata.Bounds[4],
                        (float)eptMetadata.Bounds[5]
                    ],
                    HasNormals = eptMetadata.Schema.Any(s => s.Name == "NormalX"),
                    HasColors = eptMetadata.Schema.Any(s => s.Name == "Red"),
                    Format = PointCloudFormat.ept,
                    CreatedAt = Directory.GetCreationTime(pointCloudDir),
                    FileSizeBytes = GetDirectorySize(pointCloudDir)
                };
            }
        }

        // Check for JSON format
        var jsonPath = Path.Combine(pointCloudDir, "pointcloud.json");
        if (File.Exists(jsonPath))
        {
            var jsonContent = await File.ReadAllTextAsync(jsonPath);
            var pointCloud = JsonSerializer.Deserialize<PointCloud>(jsonContent, new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true
            });

            if (pointCloud?.Metadata != null)
            {
                pointCloud.Metadata.Id = id;
                pointCloud.Metadata.Format = PointCloudFormat.json;
                pointCloud.Metadata.CreatedAt = File.GetCreationTime(jsonPath);
                pointCloud.Metadata.FileSizeBytes = new FileInfo(jsonPath).Length;
                return pointCloud.Metadata;
            }
        }

        return null;
    }

    public async Task<PointCloud?> GetPointCloudDataAsync(string id)
    {
        var jsonPath = Path.Combine(_dataPath, id, "pointcloud.json");

        if (!File.Exists(jsonPath))
            return null;

        var jsonContent = await File.ReadAllTextAsync(jsonPath);
        var pointCloud = JsonSerializer.Deserialize<PointCloud>(jsonContent, new JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true
        });

        return pointCloud;
    }

    public async Task<EptMetadata?> GetEptMetadataAsync(string id)
    {
        var eptPath = Path.Combine(_dataPath, id, "ept.json");

        if (!File.Exists(eptPath))
            return null;

        var jsonContent = await File.ReadAllTextAsync(eptPath);
        var eptMetadata = JsonSerializer.Deserialize<EptMetadata>(jsonContent, new JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true
        });

        return eptMetadata;
    }

    public async Task<byte[]?> GetEptTileAsync(string id, string tileKey)
    {
        var tilePath = Path.Combine(_dataPath, id, "ept-data", $"{tileKey}.bin");

        if (!File.Exists(tilePath))
            return null;

        return await File.ReadAllBytesAsync(tilePath);
    }

    public async Task<string?> GetEptHierarchyAsync(string id, string tileKey)
    {
        var hierarchyPath = Path.Combine(_dataPath, id, "ept-hierarchy", $"{tileKey}.json");

        if (!File.Exists(hierarchyPath))
            return null;

        return await File.ReadAllTextAsync(hierarchyPath);
    }

    private static long GetDirectorySize(string directoryPath)
    {
        var directoryInfo = new DirectoryInfo(directoryPath);
        return directoryInfo.EnumerateFiles("*", SearchOption.AllDirectories)
            .Sum(file => file.Length);
    }
}
