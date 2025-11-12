using HueGraphics.API.Hubs;
using HueGraphics.Application.Interfaces;
using HueGraphics.Domain;
using Microsoft.AspNetCore.SignalR;

namespace HueGraphics.API.Services;

/// <summary>
/// Service that broadcasts Kinect frames and status via SignalR
/// </summary>
public class KinectHubBroadcaster : IKinectHubClient
{
    private readonly IHubContext<KinectHub> _hubContext;

    public KinectHubBroadcaster(IHubContext<KinectHub> hubContext)
    {
        _hubContext = hubContext;
    }

    public async Task BroadcastFrameAsync(KinectPointCloudFrame frame)
    {
        await _hubContext.Clients.All.SendAsync("ReceiveFrame", frame);
    }

    public async Task BroadcastStatusAsync(KinectStreamStatus status)
    {
        await _hubContext.Clients.All.SendAsync("ReceiveStatus", status);
    }
}
