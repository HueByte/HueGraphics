using HueGraphics.Application.Interfaces;
using HueGraphics.Domain;
using Microsoft.AspNetCore.SignalR;

namespace HueGraphics.API.Hubs;

/// <summary>
/// SignalR hub for streaming Kinect point cloud frames to clients
/// Manages connection count to control bridge streaming
/// </summary>
public class KinectHub : Hub
{
    private readonly ILogger<KinectHub> _logger;
    private readonly IKinectService _kinectService;
    private static int _activeConnections = 0;
    private static readonly object _connectionLock = new();

    public KinectHub(ILogger<KinectHub> logger, IKinectService kinectService)
    {
        _logger = logger;
        _kinectService = kinectService;
    }

    public override async Task OnConnectedAsync()
    {
        bool shouldStartStreaming = false;

        lock (_connectionLock)
        {
            _activeConnections++;
            _logger.LogInformation("Client connected to Kinect hub: {ConnectionId}. Active connections: {Count}",
                Context.ConnectionId, _activeConnections);

            // Start streaming only when first client connects
            shouldStartStreaming = _activeConnections == 1;
        }

        if (shouldStartStreaming)
        {
            _logger.LogInformation("First client connected - starting Kinect streaming");
            try
            {
                await _kinectService.StartStreamingAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to start Kinect streaming for first client");
            }
        }

        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        bool shouldStopStreaming = false;

        lock (_connectionLock)
        {
            _activeConnections--;
            _logger.LogInformation("Client disconnected from Kinect hub: {ConnectionId}. Active connections: {Count}",
                Context.ConnectionId, _activeConnections);

            // Stop streaming only when last client disconnects
            shouldStopStreaming = _activeConnections == 0;
        }

        if (shouldStopStreaming)
        {
            _logger.LogInformation("Last client disconnected - stopping Kinect streaming");
            try
            {
                await _kinectService.StopStreamingAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to stop Kinect streaming after last client disconnect");
            }
        }

        await base.OnDisconnectedAsync(exception);
    }

    /// <summary>
    /// Send a frame to all connected clients
    /// </summary>
    public async Task BroadcastFrame(KinectPointCloudFrame frame)
    {
        await Clients.All.SendAsync("ReceiveFrame", frame);
    }
}
