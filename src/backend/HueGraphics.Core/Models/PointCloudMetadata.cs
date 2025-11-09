using System.Text.Json.Serialization;

namespace HueGraphics.Core.Models;

public class PointCloudMetadata
{
    public required string Id { get; set; }
    public required string SourceFile { get; set; }
    public int PointCount { get; set; }
    public float[] BoundsMin { get; set; } = new float[3];
    public float[] BoundsMax { get; set; } = new float[3];
    public bool HasNormals { get; set; }
    public bool HasColors { get; set; }
    public PointCloudFormat Format { get; set; }
    public DateTime CreatedAt { get; set; }
    public long FileSizeBytes { get; set; }
}

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum PointCloudFormat
{
    json,
    ept
}
