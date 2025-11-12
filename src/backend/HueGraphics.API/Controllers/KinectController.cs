using HueGraphics.Application.Interfaces;
using HueGraphics.Domain;
using Microsoft.AspNetCore.Mvc;

namespace HueGraphics.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class KinectController : ControllerBase
{
    private readonly IKinectService _kinectService;
    private readonly ILogger<KinectController> _logger;
    private readonly IConfiguration _configuration;

    public KinectController(
        IKinectService kinectService,
        ILogger<KinectController> logger,
        IConfiguration configuration)
    {
        _kinectService = kinectService;
        _logger = logger;
        _configuration = configuration;
    }

    private bool IsKinectEnabled()
    {
        return _configuration.GetValue<bool>("FeatureFlags:KinectEnabled", false);
    }

    /// <summary>
    /// Initialize the Kinect sensor
    /// </summary>
    [HttpPost("initialize")]
    public async Task<IActionResult> Initialize()
    {
        if (!IsKinectEnabled())
        {
            return BadRequest(new { message = "Kinect feature is disabled" });
        }

        try
        {
            _logger.LogInformation("Initializing Kinect sensor via API");
            var success = await _kinectService.InitializeAsync();

            if (success)
            {
                return Ok(new { message = "Kinect sensor initialized successfully" });
            }

            var status = _kinectService.GetStatus();
            return BadRequest(new { message = "Failed to initialize Kinect sensor", error = status.ErrorMessage });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error initializing Kinect sensor");
            return StatusCode(500, new { message = "Internal server error", error = ex.Message });
        }
    }

    /// <summary>
    /// Start streaming point cloud data from Kinect
    /// </summary>
    [HttpPost("start")]
    public async Task<IActionResult> StartStreaming()
    {
        if (!IsKinectEnabled())
        {
            return BadRequest(new { message = "Kinect feature is disabled" });
        }

        try
        {
            _logger.LogInformation("Starting Kinect streaming via API");
            await _kinectService.StartStreamingAsync();
            return Ok(new { message = "Kinect streaming started" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error starting Kinect streaming");
            return BadRequest(new { message = "Failed to start streaming", error = ex.Message });
        }
    }

    /// <summary>
    /// Stop streaming point cloud data
    /// </summary>
    [HttpPost("stop")]
    public async Task<IActionResult> StopStreaming()
    {
        if (!IsKinectEnabled())
        {
            return BadRequest(new { message = "Kinect feature is disabled" });
        }

        try
        {
            _logger.LogInformation("Stopping Kinect streaming via API");
            await _kinectService.StopStreamingAsync();
            return Ok(new { message = "Kinect streaming stopped" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error stopping Kinect streaming");
            return BadRequest(new { message = "Failed to stop streaming", error = ex.Message });
        }
    }

    /// <summary>
    /// Get the current status of the Kinect sensor
    /// </summary>
    [HttpGet("status")]
    public IActionResult GetStatus()
    {
        if (!IsKinectEnabled())
        {
            return BadRequest(new { message = "Kinect feature is disabled" });
        }

        try
        {
            var status = _kinectService.GetStatus();
            return Ok(status);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting Kinect status");
            return StatusCode(500, new { message = "Internal server error", error = ex.Message });
        }
    }

    /// <summary>
    /// Get the latest point cloud frame from Kinect
    /// </summary>
    [HttpGet("frame")]
    public IActionResult GetLatestFrame()
    {
        if (!IsKinectEnabled())
        {
            return BadRequest(new { message = "Kinect feature is disabled" });
        }

        try
        {
            var frame = _kinectService.GetLatestFrame();

            if (frame == null)
            {
                return NotFound(new { message = "No frame available" });
            }

            return Ok(frame);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting latest frame");
            return StatusCode(500, new { message = "Internal server error", error = ex.Message });
        }
    }

    /// <summary>
    /// Stream point cloud frames via Server-Sent Events (SSE)
    /// </summary>
    [HttpGet("stream")]
    public async Task StreamFrames()
    {
        if (!IsKinectEnabled())
        {
            Response.StatusCode = 400;
            await Response.WriteAsJsonAsync(new { message = "Kinect feature is disabled" });
            return;
        }

        Response.Headers.Append("Content-Type", "text/event-stream");
        Response.Headers.Append("Cache-Control", "no-cache");
        Response.Headers.Append("Connection", "keep-alive");

        var cancellationToken = HttpContext.RequestAborted;

        void OnFrameAvailable(object? sender, KinectPointCloudFrame frame)
        {
            try
            {
                // Send frame data as JSON via SSE
                var json = System.Text.Json.JsonSerializer.Serialize(frame);
                var message = $"data: {json}\n\n";
                var bytes = System.Text.Encoding.UTF8.GetBytes(message);

                Response.Body.WriteAsync(bytes, 0, bytes.Length, cancellationToken).Wait();
                Response.Body.FlushAsync(cancellationToken).Wait();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error sending frame via SSE");
            }
        }

        try
        {
            _kinectService.FrameAvailable += OnFrameAvailable;

            // Keep connection alive until client disconnects
            while (!cancellationToken.IsCancellationRequested)
            {
                await Task.Delay(100, cancellationToken);
            }
        }
        catch (OperationCanceledException)
        {
            _logger.LogInformation("Client disconnected from Kinect stream");
        }
        finally
        {
            _kinectService.FrameAvailable -= OnFrameAvailable;
        }
    }
}
