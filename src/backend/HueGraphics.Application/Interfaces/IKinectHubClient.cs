using HueGraphics.Domain;

namespace HueGraphics.Application.Interfaces;

/// <summary>
/// Interface for broadcasting Kinect frames and status to clients
/// </summary>
public interface IKinectHubClient
{
    Task BroadcastFrameAsync(KinectPointCloudFrame frame);
    Task BroadcastStatusAsync(KinectStreamStatus status);
}
