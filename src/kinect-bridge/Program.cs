using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Diagnostics;
using System.Linq;
using System.Net;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Kinect;
using Newtonsoft.Json;

namespace KinectBridge
{
    /// <summary>
    /// Kinect v2 Bridge for .NET Framework
    /// Captures data from Kinect and serves it via HTTP for .NET 8 API consumption
    /// </summary>
    class Program
    {
        private static KinectSensor? sensor;
        private static MultiSourceFrameReader? reader;
        private static HttpListener? httpListener;
        private static PointCloudFrame? latestFrame;
        private static string? latestFrameJson;
        private static readonly object frameLock = new object();
        private static long frameCount = 0;
        private static bool isStreaming = false;
        private static readonly Stopwatch fpsStopwatch = new Stopwatch();
        private static int fpsFrameCount = 0;
        private static double currentFps = 0;

        // Configuration options
        private static int pointDensity = 2; // Process every Nth point (1 = all points, 2 = 50%, 3 = 33%, etc.)
        private static bool useDepthGradient = false; // Use depth gradient coloring instead of RGB

        // TPL configuration for thread reuse
        private static readonly ParallelOptions parallelOptions = new()
        {
            MaxDegreeOfParallelism = Environment.ProcessorCount
        };

        static void Main(string[] args)
        {
            Console.WriteLine("======================================");
            Console.WriteLine("  Kinect v2 Bridge for .NET 8");
            Console.WriteLine("======================================");
            Console.WriteLine();

            // Parse command line arguments
            int port = 5555;
            for (int i = 0; i < args.Length; i++)
            {
                if (args[i] == "--port" && i + 1 < args.Length && int.TryParse(args[i + 1], out int customPort))
                {
                    port = customPort;
                }
                else if (args[i] == "--density" && i + 1 < args.Length && int.TryParse(args[i + 1], out int density))
                {
                    pointDensity = Math.Max(1, Math.Min(10, density)); // Clamp between 1-10
                }
                else if (args[i] == "--depth-gradient")
                {
                    useDepthGradient = true;
                }
            }

            Console.WriteLine($"Configuration:");
            Console.WriteLine($"  Port: {port}");
            Console.WriteLine($"  Point Density: Every {pointDensity} point(s) ({100.0 / pointDensity:F1}%)");
            Console.WriteLine($"  Color Mode: {(useDepthGradient ? "Depth Gradient" : "RGB Camera")}");
            Console.WriteLine();
            Console.WriteLine("Usage: KinectBridge [--port <port>] [--density <1-10>] [--depth-gradient]");
            Console.WriteLine();

            // Start HTTP server
            StartHttpServer(port);

            Console.WriteLine($"Bridge running on http://localhost:{port}");
            Console.WriteLine();
            Console.WriteLine("Endpoints:");
            Console.WriteLine($"  GET  http://localhost:{port}/status");
            Console.WriteLine($"  POST http://localhost:{port}/initialize");
            Console.WriteLine($"  POST http://localhost:{port}/start");
            Console.WriteLine($"  POST http://localhost:{port}/stop");
            Console.WriteLine($"  GET  http://localhost:{port}/frame");
            Console.WriteLine();
            Console.WriteLine("Press Ctrl+C to exit");
            Console.WriteLine();

            // Keep running
            Console.CancelKeyPress += (s, e) =>
            {
                e.Cancel = true;
                Cleanup();
                Environment.Exit(0);
            };

            // Wait indefinitely
            Thread.Sleep(Timeout.Infinite);
        }

        static void StartHttpServer(int port)
        {
            httpListener = new HttpListener();
            httpListener.Prefixes.Add($"http://localhost:{port}/");

            try
            {
                httpListener.Start();
                Console.WriteLine($"[OK] HTTP server started on port {port}");

                // Handle requests asynchronously
                Task.Run(() => HandleRequests());
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[ERROR] Failed to start HTTP server: {ex.Message}");
                Environment.Exit(1);
            }
        }

        static async void HandleRequests()
        {
            while (httpListener != null && httpListener.IsListening)
            {
                try
                {
                    var context = await httpListener.GetContextAsync();
                    _ = Task.Run(() => ProcessRequest(context));
                }
                catch (Exception ex)
                {
                    if (httpListener == null || !httpListener.IsListening)
                        break;
                    Console.WriteLine($"[ERROR] Request handling error: {ex.Message}");
                }
            }
        }

        static void ProcessRequest(HttpListenerContext context)
        {
            var request = context.Request;
            var response = context.Response;

            // Enable CORS
            response.AddHeader("Access-Control-Allow-Origin", "*");
            response.AddHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
            response.AddHeader("Access-Control-Allow-Headers", "Content-Type");

            if (request.HttpMethod == "OPTIONS")
            {
                response.StatusCode = 200;
                response.Close();
                return;
            }

            try
            {
                var path = request.Url?.AbsolutePath ?? "/";
                var method = request.HttpMethod;

                Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] {method} {path}");

                switch (path)
                {
                    case "/status":
                        HandleStatus(response);
                        break;
                    case "/initialize":
                        HandleInitialize(response);
                        break;
                    case "/start":
                        HandleStart(response);
                        break;
                    case "/stop":
                        HandleStop(response);
                        break;
                    case "/frame":
                        HandleFrame(response);
                        break;
                    default:
                        SendJsonResponse(response, 404, new { error = "Endpoint not found" });
                        break;
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[ERROR] {ex.Message}");
                SendJsonResponse(response, 500, new { error = ex.Message });
            }
        }

        static void HandleStatus(HttpListenerResponse response)
        {
            var status = new
            {
                isConnected = sensor != null && sensor.IsAvailable,
                isStreaming = isStreaming,
                fps = currentFps,
                totalFrames = frameCount,
                statusMessage = GetStatusMessage(),
                errorMessage = (string?)null
            };

            SendJsonResponse(response, 200, status);
        }

        static void HandleInitialize(HttpListenerResponse response)
        {
            if (sensor != null)
            {
                SendJsonResponse(response, 200, new { message = "Sensor already initialized" });
                return;
            }

            try
            {
                sensor = KinectSensor.GetDefault();

                if (sensor == null)
                {
                    SendJsonResponse(response, 400, new { error = "No Kinect sensor found" });
                    return;
                }

                sensor.Open();
                Thread.Sleep(1000); // Wait for sensor to initialize

                if (!sensor.IsAvailable)
                {
                    SendJsonResponse(response, 400, new { error = "Kinect sensor is not available" });
                    return;
                }

                Console.WriteLine("[OK] Kinect sensor initialized");
                SendJsonResponse(response, 200, new { message = "Kinect sensor initialized successfully" });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[ERROR] Failed to initialize: {ex.Message}");
                SendJsonResponse(response, 500, new { error = $"Initialization failed: {ex.Message}" });
            }
        }

        static void HandleStart(HttpListenerResponse response)
        {
            if (sensor == null || !sensor.IsAvailable)
            {
                SendJsonResponse(response, 400, new { error = "Sensor not initialized" });
                return;
            }

            if (isStreaming)
            {
                SendJsonResponse(response, 200, new { message = "Already streaming" });
                return;
            }

            try
            {
                reader = sensor.OpenMultiSourceFrameReader(FrameSourceTypes.Depth | FrameSourceTypes.Color);
                reader.MultiSourceFrameArrived += OnFrameArrived;

                isStreaming = true;
                frameCount = 0;
                fpsFrameCount = 0;
                fpsStopwatch.Restart();

                Console.WriteLine("[OK] Streaming started");
                SendJsonResponse(response, 200, new { message = "Streaming started" });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[ERROR] Failed to start streaming: {ex.Message}");
                SendJsonResponse(response, 500, new { error = $"Failed to start: {ex.Message}" });
            }
        }

        static void HandleStop(HttpListenerResponse response)
        {
            if (!isStreaming)
            {
                SendJsonResponse(response, 200, new { message = "Not streaming" });
                return;
            }

            try
            {
                if (reader != null)
                {
                    reader.MultiSourceFrameArrived -= OnFrameArrived;
                    reader.Dispose();
                    reader = null;
                }

                isStreaming = false;
                fpsStopwatch.Stop();

                Console.WriteLine("[OK] Streaming stopped");
                SendJsonResponse(response, 200, new { message = "Streaming stopped" });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[ERROR] Failed to stop streaming: {ex.Message}");
                SendJsonResponse(response, 500, new { error = $"Failed to stop: {ex.Message}" });
            }
        }

        static void HandleFrame(HttpListenerResponse response)
        {
            string? json;
            lock (frameLock)
            {
                if (latestFrameJson == null)
                {
                    SendJsonResponse(response, 404, new { error = "No frame available" });
                    return;
                }

                json = latestFrameJson;
            }

            // Send cached JSON directly - much faster than re-serializing
            response.StatusCode = 200;
            response.ContentType = "application/json";
            var buffer = Encoding.UTF8.GetBytes(json);
            response.ContentLength64 = buffer.Length;
            response.OutputStream.Write(buffer, 0, buffer.Length);
            response.Close();
        }

        static void OnFrameArrived(object? sender, MultiSourceFrameArrivedEventArgs e)
        {
            try
            {
                var frameReference = e.FrameReference;
                var multiFrame = frameReference.AcquireFrame();

                if (multiFrame == null) return;

                using (var depthFrame = multiFrame.DepthFrameReference.AcquireFrame())
                using (var colorFrame = multiFrame.ColorFrameReference.AcquireFrame())
                {
                    if (depthFrame == null || colorFrame == null) return;

                    var depthDesc = depthFrame.FrameDescription;
                    var colorDesc = colorFrame.FrameDescription;
                    var mapper = sensor!.CoordinateMapper;

                    // Get depth data
                    var depthWidth = depthDesc.Width;
                    var depthHeight = depthDesc.Height;
                    var depthDataSize = depthWidth * depthHeight;
                    var depthData = new ushort[depthDataSize];
                    depthFrame.CopyFrameDataToArray(depthData);

                    // Get color data (only if using RGB mode)
                    byte[]? colorData = null;
                    ColorSpacePoint[]? colorPoints = null;
                    int colorWidth = 0;
                    int colorHeight = 0;

                    if (!useDepthGradient)
                    {
                        colorWidth = colorDesc.Width;
                        colorHeight = colorDesc.Height;
                        var colorDataSize = colorWidth * colorHeight * 4;
                        colorData = new byte[colorDataSize];
                        colorFrame.CopyConvertedFrameDataToArray(colorData, ColorImageFormat.Bgra);

                        // Map depth to color space
                        colorPoints = new ColorSpacePoint[depthDataSize];
                        mapper.MapDepthFrameToColorSpace(depthData, colorPoints);
                    }

                    // Map depth to camera space
                    var cameraPoints = new CameraSpacePoint[depthDataSize];
                    mapper.MapDepthFrameToCameraSpace(depthData, cameraPoints);

                    // Calculate depth range for gradient coloring using TPL
                    float minDepth = float.MaxValue;
                    float maxDepth = float.MinValue;
                    if (useDepthGradient)
                    {
                        // Thread-local min/max to avoid contention
                        object lockObj = new();
                        Parallel.For(0, depthDataSize, parallelOptions, () => (min: float.MaxValue, max: float.MinValue),
                            (i, state, localMinMax) =>
                            {
                                var depth = depthData[i] / 1000.0f; // Convert mm to meters
                                if (depth > 0 && depth < 8.0f) // Valid range for Kinect v2
                                {
                                    if (depth < localMinMax.min) localMinMax.min = depth;
                                    if (depth > localMinMax.max) localMinMax.max = depth;
                                }
                                return localMinMax;
                            },
                            localMinMax =>
                            {
                                lock (lockObj)
                                {
                                    if (localMinMax.min < minDepth) minDepth = localMinMax.min;
                                    if (localMinMax.max > maxDepth) maxDepth = localMinMax.max;
                                }
                            });
                    }

                    // Build point cloud with configurable density using TPL
                    // Pre-allocate approximate capacity to reduce reallocations
                    var estimatedPoints = depthDataSize / pointDensity;
                    var pointsLock = new object();
                    var points = new List<float>(estimatedPoints * 3);
                    var colors = new List<byte>(estimatedPoints * 3);

                    // Process in parallel using Partitioner for better load balancing
                    var indices = Enumerable.Range(0, depthDataSize / pointDensity)
                        .Select(x => x * pointDensity)
                        .ToArray();

                    Parallel.ForEach(
                        Partitioner.Create(0, indices.Length),
                        parallelOptions,
                        () => (points: new List<float>(), colors: new List<byte>()),
                        (range, state, localData) =>
                        {
                            for (int idx = range.Item1; idx < range.Item2; idx++)
                            {
                                int i = indices[idx];
                                var point = cameraPoints[i];

                                // Skip invalid points
                                if (float.IsInfinity(point.X) || float.IsInfinity(point.Y) || float.IsInfinity(point.Z))
                                    continue;

                                // Add position to local list
                                localData.points.Add(point.X);
                                localData.points.Add(point.Y);
                                localData.points.Add(point.Z);

                                // Add color based on mode
                                if (useDepthGradient)
                                {
                                    // Depth gradient coloring (cyan -> blue -> purple -> red)
                                    var depth = depthData[i] / 1000.0f; // mm to meters
                                    var normalizedDepth = (depth - minDepth) / (maxDepth - minDepth);
                                    normalizedDepth = Math.Max(0, Math.Min(1, normalizedDepth)); // Clamp 0-1

                                    // Color gradient: cyan (near) -> blue -> purple -> red (far)
                                    byte r, g, b;
                                    if (normalizedDepth < 0.33f)
                                    {
                                        // Cyan to Blue
                                        var t = normalizedDepth / 0.33f;
                                        r = 0;
                                        g = (byte)(255 * (1 - t));
                                        b = 255;
                                    }
                                    else if (normalizedDepth < 0.66f)
                                    {
                                        // Blue to Purple
                                        var t = (normalizedDepth - 0.33f) / 0.33f;
                                        r = (byte)(128 * t);
                                        g = 0;
                                        b = 255;
                                    }
                                    else
                                    {
                                        // Purple to Red
                                        var t = (normalizedDepth - 0.66f) / 0.34f;
                                        r = (byte)(128 + 127 * t);
                                        g = 0;
                                        b = (byte)(255 * (1 - t));
                                    }

                                    localData.colors.Add(r);
                                    localData.colors.Add(g);
                                    localData.colors.Add(b);
                                }
                                else
                                {
                                    // RGB camera coloring
                                    var colorPoint = colorPoints![i];
                                    var colorX = (int)Math.Floor(colorPoint.X + 0.5);
                                    var colorY = (int)Math.Floor(colorPoint.Y + 0.5);

                                    if (colorX >= 0 && colorX < colorWidth && colorY >= 0 && colorY < colorHeight)
                                    {
                                        var colorIndex = (colorY * colorWidth + colorX) * 4;
                                        localData.colors.Add(colorData![colorIndex + 2]); // R
                                        localData.colors.Add(colorData![colorIndex + 1]); // G
                                        localData.colors.Add(colorData![colorIndex]);     // B
                                    }
                                    else
                                    {
                                        localData.colors.Add(128);
                                        localData.colors.Add(128);
                                        localData.colors.Add(128);
                                    }
                                }
                            }
                            return localData;
                        },
                        localData =>
                        {
                            // Merge local results into main lists
                            lock (pointsLock)
                            {
                                points.AddRange(localData.points);
                                colors.AddRange(localData.colors);
                            }
                        });

                    // Create frame object
                    var frame = new PointCloudFrame
                    {
                        Timestamp = DateTime.UtcNow,
                        Points = points.ToArray(),
                        Colors = colors.ToArray(),
                        PointCount = points.Count / 3,
                        FrameNumber = frameCount++
                    };

                    // Debug logging every 30 frames
                    if (frameCount % 30 == 0)
                    {
                        Console.WriteLine($"[DEBUG] Frame {frameCount}: {frame.PointCount} points captured (raw depth data: {depthDataSize} samples)");
                    }

                    // Update FPS
                    fpsFrameCount++;
                    if (fpsStopwatch.ElapsedMilliseconds >= 1000)
                    {
                        currentFps = fpsFrameCount / (fpsStopwatch.ElapsedMilliseconds / 1000.0);
                        fpsFrameCount = 0;
                        fpsStopwatch.Restart();
                        Console.WriteLine($"[FPS] {currentFps:F1} fps, Total: {frameCount} frames, Latest: {frame.PointCount} points");
                    }

                    // Pre-serialize the JSON to avoid repeated serialization on each HTTP request
                    var json = JsonConvert.SerializeObject(frame);

                    // Store latest frame and its JSON
                    lock (frameLock)
                    {
                        latestFrame = frame;
                        latestFrameJson = json;
                    }
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[ERROR] Frame processing error: {ex.Message}");
            }
        }

        static string GetStatusMessage()
        {
            if (sensor == null)
                return "Not initialized";
            if (!sensor.IsAvailable)
                return "Sensor not available";
            if (isStreaming)
                return "Streaming";
            return "Ready";
        }

        static void SendJsonResponse(HttpListenerResponse response, int statusCode, object data)
        {
            response.StatusCode = statusCode;
            response.ContentType = "application/json";

            var json = JsonConvert.SerializeObject(data);
            var buffer = Encoding.UTF8.GetBytes(json);

            response.ContentLength64 = buffer.Length;
            response.OutputStream.Write(buffer, 0, buffer.Length);
            response.Close();
        }

        static void Cleanup()
        {
            Console.WriteLine();
            Console.WriteLine("Shutting down...");

            if (reader != null)
            {
                reader.MultiSourceFrameArrived -= OnFrameArrived;
                reader.Dispose();
            }

            if (sensor != null)
            {
                sensor.Close();
            }

            if (httpListener != null && httpListener.IsListening)
            {
                httpListener.Stop();
                httpListener.Close();
            }

            Console.WriteLine("Cleanup complete");
        }
    }

    public class PointCloudFrame
    {
        public DateTime Timestamp { get; set; }
        public float[] Points { get; set; } = Array.Empty<float>();
        public byte[] Colors { get; set; } = Array.Empty<byte>();
        public int PointCount { get; set; }
        public long FrameNumber { get; set; }
    }
}
