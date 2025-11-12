namespace HueGraphics.Domain;

/// <summary>
/// Represents the current status of the Kinect sensor
/// </summary>
public class KinectStreamStatus
{
    /// <summary>
    /// Whether the Kinect sensor is connected
    /// </summary>
    public bool IsConnected { get; set; }

    /// <summary>
    /// Whether the Kinect sensor is currently streaming
    /// </summary>
    public bool IsStreaming { get; set; }

    /// <summary>
    /// Current frames per second
    /// </summary>
    public double FPS { get; set; }

    /// <summary>
    /// Total frames captured in current session
    /// </summary>
    public long TotalFrames { get; set; }

    /// <summary>
    /// Any error message if sensor is not working
    /// </summary>
    public string? ErrorMessage { get; set; }

    /// <summary>
    /// Sensor status message
    /// </summary>
    public string StatusMessage { get; set; } = "Idle";
}
