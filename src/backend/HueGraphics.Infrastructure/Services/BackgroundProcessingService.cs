using System.Collections.Concurrent;
using System.Diagnostics;
using System.IO.Compression;
using HueGraphics.Application.Interfaces;
using HueGraphics.Core.Models;
using HueGraphics.Domain.Settings;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace HueGraphics.Infrastructure.Services;

public class BackgroundProcessingService : IBackgroundProcessingService
{
    private readonly ILogger<BackgroundProcessingService> _logger;
    private readonly PointCloudSettings _pointCloudSettings;
    private readonly ModelParserSettings _parserSettings;
    private readonly ConcurrentDictionary<string, ProcessingStatus> _processingStatuses;

    public BackgroundProcessingService(
        ILogger<BackgroundProcessingService> logger,
        IOptions<PointCloudSettings> pointCloudSettings,
        IOptions<ModelParserSettings> parserSettings)
    {
        _logger = logger;
        _pointCloudSettings = pointCloudSettings.Value;
        _parserSettings = parserSettings.Value;
        _processingStatuses = new ConcurrentDictionary<string, ProcessingStatus>();
    }

    public void QueueModelProcessing(string modelId, string zipPath, string? name, string? description)
    {
        var status = new ProcessingStatus
        {
            Id = modelId,
            Status = "pending",
            Progress = 0,
            CreatedAt = DateTime.UtcNow
        };

        _processingStatuses[modelId] = status;

        // Start background task
        _ = Task.Run(async () => await ProcessModelAsync(modelId, zipPath, name, description));
    }

    public ProcessingStatus? GetProcessingStatus(string modelId)
    {
        return _processingStatuses.TryGetValue(modelId, out var status) ? status : null;
    }

    private async Task ProcessModelAsync(string modelId, string zipPath, string? name, string? description)
    {
        try
        {
            _logger.LogInformation("Starting background processing for model {ModelId}", modelId);
            UpdateStatus(modelId, "processing", 10);

            var tempDir = Path.Combine(Path.GetTempPath(), Guid.NewGuid().ToString());
            Directory.CreateDirectory(tempDir);

            try
            {
                // Extract zip file
                _logger.LogInformation("Extracting ZIP archive for {ModelId}", modelId);
                var extractDir = Path.Combine(tempDir, "extracted");
                ZipFile.ExtractToDirectory(zipPath, extractDir);
                UpdateStatus(modelId, "processing", 30);

                // Find 3D model file
                var modelFile = FindModelFile(extractDir);
                if (modelFile == null)
                {
                    throw new InvalidOperationException("No supported 3D model file found in ZIP archive");
                }

                UpdateStatus(modelId, "processing", 40);

                // Create output directory
                var outputDir = Path.Combine(_pointCloudSettings.DataPath, modelId);
                Directory.CreateDirectory(outputDir);

                // Run model parser
                _logger.LogInformation("Running model_parser for {ModelId}", modelId);
                UpdateStatus(modelId, "processing", 50);

                await RunModelParserAsync(modelFile, outputDir);

                UpdateStatus(modelId, "processing", 90);

                // Create metadata
                var metadataPath = Path.Combine(outputDir, "metadata.json");
                var metadata = new PointCloudMetadata
                {
                    Id = modelId,
                    Name = name ?? Path.GetFileNameWithoutExtension(modelFile),
                    Description = description,
                    SourceFile = Path.GetFileName(modelFile),
                    Format = PointCloudFormat.ept,
                    CreatedAt = DateTime.UtcNow
                };

                var metadataJson = System.Text.Json.JsonSerializer.Serialize(metadata, new System.Text.Json.JsonSerializerOptions
                {
                    WriteIndented = true
                });
                await File.WriteAllTextAsync(metadataPath, metadataJson);

                UpdateStatus(modelId, "completed", 100);
                _logger.LogInformation("Successfully completed processing for model {ModelId}", modelId);
            }
            finally
            {
                // Cleanup temp directory
                if (Directory.Exists(tempDir))
                {
                    Directory.Delete(tempDir, true);
                }

                // Delete uploaded zip file
                if (File.Exists(zipPath))
                {
                    File.Delete(zipPath);
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to process model {ModelId}", modelId);
            UpdateStatus(modelId, "failed", 0, ex.Message);
        }
    }

    private void UpdateStatus(string modelId, string status, int progress, string? errorMessage = null)
    {
        if (_processingStatuses.TryGetValue(modelId, out var existingStatus))
        {
            existingStatus.Status = status;
            existingStatus.Progress = progress;
            existingStatus.ErrorMessage = errorMessage;

            if (status == "completed" || status == "failed")
            {
                existingStatus.CompletedAt = DateTime.UtcNow;
            }
        }
    }

    private string? FindModelFile(string directory)
    {
        var supportedExtensions = new[] { ".gltf", ".glb", ".obj", ".fbx", ".ply" };

        foreach (var ext in supportedExtensions)
        {
            var files = Directory.GetFiles(directory, $"*{ext}", SearchOption.AllDirectories);
            if (files.Length > 0)
            {
                return files[0];
            }
        }

        return null;
    }

    private async Task RunModelParserAsync(string inputPath, string outputPath)
    {
        var startInfo = new ProcessStartInfo
        {
            FileName = _parserSettings.ExecutablePath,
            Arguments = $"--input \"{inputPath}\" --output \"{outputPath}\" --format ept --point-count {_parserSettings.DefaultPointCount}",
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
            CreateNoWindow = true
        };

        using var process = new Process { StartInfo = startInfo };

        var outputBuilder = new System.Text.StringBuilder();
        var errorBuilder = new System.Text.StringBuilder();

        process.OutputDataReceived += (sender, args) =>
        {
            if (!string.IsNullOrEmpty(args.Data))
            {
                outputBuilder.AppendLine(args.Data);
                _logger.LogInformation("model_parser: {Output}", args.Data);
            }
        };

        process.ErrorDataReceived += (sender, args) =>
        {
            if (!string.IsNullOrEmpty(args.Data))
            {
                errorBuilder.AppendLine(args.Data);
                _logger.LogWarning("model_parser error: {Error}", args.Data);
            }
        };

        process.Start();
        process.BeginOutputReadLine();
        process.BeginErrorReadLine();

        await process.WaitForExitAsync();

        if (process.ExitCode != 0)
        {
            throw new InvalidOperationException($"model_parser failed with exit code {process.ExitCode}: {errorBuilder}");
        }
    }
}
