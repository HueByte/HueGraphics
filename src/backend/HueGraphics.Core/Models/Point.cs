namespace HueGraphics.Core.Models;

public class Point
{
    public required float[] Position { get; set; } // [x, y, z]
    public float[]? Normal { get; set; }           // [x, y, z]
    public float[]? Color { get; set; }            // [r, g, b]
}

public class PointCloud
{
    public required PointCloudMetadata Metadata { get; set; }
    public required List<Point> Points { get; set; }
}
