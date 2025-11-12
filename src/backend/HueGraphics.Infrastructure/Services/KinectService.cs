using HueGraphics.Application.Interfaces;
using HueGraphics.Domain;
using Microsoft.Extensions.Logging;
using System.Net.Http.Json;
using System.Text.Json;

namespace HueGraphics.Infrastructure.Services;

/// <summary>
/// Service for capturing point cloud data from Kinect v2 sensor via bridge
/// Communicates with KinectBridge (.NET Framework) for hardware access
/// </summary>
public class KinectService : IKinectService
{
    private readonly ILogger<KinectService> _logger;
    private readonly HttpClient _httpClient;
    private readonly IKinectHubClient? _hubClient;
    private KinectPointCloudFrame? _latestFrame;
    private KinectStreamStatus _status;
    private bool _isDisposed;
    private readonly object _lock = new();
    private CancellationTokenSource? _pollingCancellation;
    private readonly string _bridgeUrl;

    public event EventHandler<KinectPointCloudFrame>? FrameAvailable;

    public KinectService(ILogger<KinectService> logger, IKinectHubClient? hubClient = null)
    {
        _logger = logger;
        _hubClient = hubClient;
        _bridgeUrl = "http://localhost:5555"; // KinectBridge port
        _httpClient = new HttpClient
        {
            BaseAddress = new Uri(_bridgeUrl),
            Timeout = TimeSpan.FromSeconds(5)
        };
        _status = new KinectStreamStatus
        {
            IsConnected = false,
            IsStreaming = false,
            StatusMessage = "Not initialized"
        };
    }

    public async Task<bool> InitializeAsync()
    {
        try
        {
            _logger.LogInformation("Initializing Kinect sensor via bridge ({BridgeUrl})...", _bridgeUrl);

            // Check if bridge is running
            var response = await _httpClient.PostAsync("/initialize", null);

            if (!response.IsSuccessStatusCode)
            {
                var errorContent = await response.Content.ReadAsStringAsync();
                _logger.LogError("Bridge initialization failed: {Error}", errorContent);
                _status.IsConnected = false;
                _status.ErrorMessage = "Failed to initialize Kinect. Ensure KinectBridge is running and sensor is connected.";
                _status.StatusMessage = "Initialization failed";
                return false;
            }

            // Update status from bridge
            await UpdateStatusFromBridge();

            _logger.LogInformation("Kinect sensor initialized successfully via bridge");
            return true;
        }
        catch (HttpRequestException ex)
        {
            _logger.LogError(ex, "Failed to connect to Kinect bridge. Is KinectBridge running?");
            _status.IsConnected = false;
            _status.ErrorMessage = $"Cannot connect to KinectBridge at {_bridgeUrl}. Please start the bridge first.";
            _status.StatusMessage = "Bridge not available";
            return false;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to initialize Kinect sensor");
            _status.IsConnected = false;
            _status.ErrorMessage = $"Initialization failed: {ex.Message}";
            _status.StatusMessage = "Initialization failed";
            return false;
        }
    }

    public async Task StartStreamingAsync()
    {
        try
        {
            _logger.LogInformation("Starting Kinect streaming via bridge...");

            var response = await _httpClient.PostAsync("/start", null);

            if (!response.IsSuccessStatusCode)
            {
                var errorContent = await response.Content.ReadAsStringAsync();
                throw new InvalidOperationException($"Failed to start streaming: {errorContent}");
            }

            // Start polling for frames
            _pollingCancellation = new CancellationTokenSource();
            _ = Task.Run(() => PollFramesAsync(_pollingCancellation.Token));

            await UpdateStatusFromBridge();

            _logger.LogInformation("Kinect streaming started successfully");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to start Kinect streaming");
            _status.IsStreaming = false;
            _status.ErrorMessage = $"Failed to start streaming: {ex.Message}";
            _status.StatusMessage = "Streaming failed";
            throw;
        }
    }

    public async Task StopStreamingAsync()
    {
        try
        {
            _logger.LogInformation("Stopping Kinect streaming...");

            // Stop polling
            if (_pollingCancellation != null)
            {
                _pollingCancellation.Cancel();
                _pollingCancellation = null;
            }

            var response = await _httpClient.PostAsync("/stop", null);

            if (!response.IsSuccessStatusCode)
            {
                var errorContent = await response.Content.ReadAsStringAsync();
                _logger.LogWarning("Failed to stop streaming via bridge: {Error}", errorContent);
            }

            await UpdateStatusFromBridge();

            _logger.LogInformation("Kinect streaming stopped");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error stopping Kinect streaming");
            throw;
        }
    }

    public KinectStreamStatus GetStatus()
    {
        lock (_lock)
        {
            return new KinectStreamStatus
            {
                IsConnected = _status.IsConnected,
                IsStreaming = _status.IsStreaming,
                FPS = _status.FPS,
                TotalFrames = _status.TotalFrames,
                ErrorMessage = _status.ErrorMessage,
                StatusMessage = _status.StatusMessage
            };
        }
    }

    public KinectPointCloudFrame? GetLatestFrame()
    {
        lock (_lock)
        {
            return _latestFrame;
        }
    }

    private async Task UpdateStatusFromBridge()
    {
        try
        {
            var bridgeStatus = await _httpClient.GetFromJsonAsync<BridgeStatus>("/status");

            if (bridgeStatus != null)
            {
                lock (_lock)
                {
                    _status.IsConnected = bridgeStatus.IsConnected;
                    _status.IsStreaming = bridgeStatus.IsStreaming;
                    _status.FPS = bridgeStatus.Fps;
                    _status.TotalFrames = bridgeStatus.TotalFrames;
                    _status.StatusMessage = bridgeStatus.StatusMessage ?? "Unknown";
                    _status.ErrorMessage = bridgeStatus.ErrorMessage;
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to update status from bridge");
        }
    }

    private async Task PollFramesAsync(CancellationToken cancellationToken)
    {
        _logger.LogInformation("Started frame polling from bridge");

        while (!cancellationToken.IsCancellationRequested)
        {
            try
            {
                // Fetch latest frame from bridge
                using var response = await _httpClient.GetAsync("/frame", cancellationToken);

                if (response.IsSuccessStatusCode)
                {
                    var frame = await response.Content.ReadFromJsonAsync<KinectPointCloudFrame>(cancellationToken);

                    if (frame != null)
                    {
                        // Store latest frame
                        lock (_lock)
                        {
                            _latestFrame = frame;
                        }

                        // Broadcast to WebSocket clients
                        if (_hubClient != null)
                        {
                            await _hubClient.BroadcastFrameAsync(frame);
                        }

                        // Notify subscribers
                        FrameAvailable?.Invoke(this, frame);
                    }
                }
                else if (response.StatusCode != System.Net.HttpStatusCode.NotFound)
                {
                    // Log errors other than 404 (404 means no frame yet, which is normal)
                    _logger.LogWarning("Bridge returned status {StatusCode} when polling for frame", response.StatusCode);
                }

                // Update status periodically (every 10 polls)
                if (_latestFrame?.FrameNumber % 10 == 0 || _latestFrame == null)
                {
                    await UpdateStatusFromBridge();

                    // Broadcast status to WebSocket clients
                    if (_hubClient != null)
                    {
                        await _hubClient.BroadcastStatusAsync(GetStatus());
                    }
                }

                // Small delay to avoid overwhelming the bridge
                await Task.Delay(33, cancellationToken); // ~30 FPS polling rate
            }
            catch (OperationCanceledException)
            {
                break;
            }
            catch (HttpRequestException ex)
            {
                _logger.LogWarning(ex, "Bridge connection error (is bridge running?)");
                await Task.Delay(1000, cancellationToken); // Retry after delay
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error polling frame from bridge");
                await Task.Delay(1000, cancellationToken); // Retry after delay
            }
        }

        _logger.LogInformation("Stopped frame polling from bridge");
    }

    public void Dispose()
    {
        if (_isDisposed) return;

        try
        {
            if (_pollingCancellation != null)
            {
                _pollingCancellation.Cancel();
                _pollingCancellation.Dispose();
                _pollingCancellation = null;
            }

            _httpClient.Dispose();
            _isDisposed = true;
            _logger.LogInformation("Kinect service disposed");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error disposing Kinect service");
        }
    }

    private class BridgeStatus
    {
        public bool IsConnected { get; set; }
        public bool IsStreaming { get; set; }
        public double Fps { get; set; }
        public long TotalFrames { get; set; }
        public string? StatusMessage { get; set; }
        public string? ErrorMessage { get; set; }
    }
}
