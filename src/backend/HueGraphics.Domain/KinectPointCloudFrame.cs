namespace HueGraphics.Domain;

/// <summary>
/// Represents a single frame of point cloud data from Kinect sensor
/// </summary>
public class KinectPointCloudFrame
{
    /// <summary>
    /// Timestamp when the frame was captured
    /// </summary>
    public DateTime Timestamp { get; set; }

    /// <summary>
    /// Array of point cloud data (X, Y, Z coordinates)
    /// Flattened array where every 3 elements represent one point
    /// </summary>
    public float[] Points { get; set; } = Array.Empty<float>();

    /// <summary>
    /// Array of color data (R, G, B values)
    /// Flattened array where every 3 elements represent color for one point
    /// </summary>
    public byte[] Colors { get; set; } = Array.Empty<byte>();

    /// <summary>
    /// Total number of points in this frame
    /// </summary>
    public int PointCount { get; set; }

    /// <summary>
    /// Frame sequence number
    /// </summary>
    public long FrameNumber { get; set; }
}
