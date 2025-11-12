using HueGraphics.Domain;

namespace HueGraphics.Application.Interfaces;

/// <summary>
/// Service for capturing point cloud data from Kinect v2 sensor
/// </summary>
public interface IKinectService
{
    /// <summary>
    /// Initialize the Kinect sensor
    /// </summary>
    Task<bool> InitializeAsync();

    /// <summary>
    /// Start streaming point cloud data from Kinect
    /// </summary>
    Task StartStreamingAsync();

    /// <summary>
    /// Stop streaming point cloud data
    /// </summary>
    Task StopStreamingAsync();

    /// <summary>
    /// Get the current status of the Kinect sensor
    /// </summary>
    KinectStreamStatus GetStatus();

    /// <summary>
    /// Get the latest point cloud frame
    /// </summary>
    KinectPointCloudFrame? GetLatestFrame();

    /// <summary>
    /// Event that fires when a new frame is available
    /// </summary>
    event EventHandler<KinectPointCloudFrame>? FrameAvailable;

    /// <summary>
    /// Dispose and cleanup Kinect resources
    /// </summary>
    void Dispose();
}
