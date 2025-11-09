using HueGraphics.Core.Models;

namespace HueGraphics.Core.Interfaces;

public interface IPointCloudService
{
    Task<IEnumerable<PointCloudMetadata>> GetAllPointCloudsAsync();
    Task<PointCloudMetadata?> GetPointCloudMetadataAsync(string id);
    Task<PointCloud?> GetPointCloudDataAsync(string id);
    Task<EptMetadata?> GetEptMetadataAsync(string id);
    Task<byte[]?> GetEptTileAsync(string id, string tileKey);
    Task<string?> GetEptHierarchyAsync(string id, string tileKey);
}
