using System.Diagnostics;
using System.IO.Compression;
using HueGraphics.Application.Interfaces;
using HueGraphics.Core.Models;
using HueGraphics.Domain.Settings;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace HueGraphics.Infrastructure.Services;

public class ModelUploadService : IModelUploadService
{
    private readonly UploadSettings _uploadSettings;
    private readonly ModelParserSettings _parserSettings;
    private readonly PointCloudSettings _pointCloudSettings;
    private readonly ILogger<ModelUploadService> _logger;

    public ModelUploadService(
        IOptions<UploadSettings> uploadSettings,
        IOptions<ModelParserSettings> parserSettings,
        IOptions<PointCloudSettings> pointCloudSettings,
        ILogger<ModelUploadService> logger)
    {
        _uploadSettings = uploadSettings.Value;
        _parserSettings = parserSettings.Value;
        _pointCloudSettings = pointCloudSettings.Value;
        _logger = logger;
    }

    public async Task<PointCloudMetadata> ProcessUploadAsync(
        IFormFile file,
        string? name,
        string? description,
        CancellationToken cancellationToken = default)
    {
        // Validate file
        ValidateFile(file);

        // Generate unique ID for this model
        var modelId = GenerateModelId(name ?? file.FileName);

        // Create temporary directory for extraction
        var tempDir = Path.Combine(Path.GetTempPath(), Guid.NewGuid().ToString());
        Directory.CreateDirectory(tempDir);

        try
        {
            // Save uploaded zip file
            var zipPath = Path.Combine(tempDir, "upload.zip");
            await using (var stream = new FileStream(zipPath, FileMode.Create))
            {
                await file.CopyToAsync(stream, cancellationToken);
            }

            // Extract zip file
            var extractDir = Path.Combine(tempDir, "extracted");
            ZipFile.ExtractToDirectory(zipPath, extractDir);

            // Find 3D model file in extracted contents
            var modelFile = FindModelFile(extractDir);
            if (modelFile == null)
            {
                throw new InvalidOperationException("No supported 3D model file found in ZIP archive");
            }

            // Create output directory in point cloud data path
            var outputDir = Path.Combine(_pointCloudSettings.DataPath, "pointcloud-data", modelId);
            Directory.CreateDirectory(outputDir);

            // Run model parser
            await RunModelParserAsync(modelFile, outputDir, cancellationToken);

            // Create metadata
            var metadata = new PointCloudMetadata
            {
                Id = modelId,
                Name = name ?? Path.GetFileNameWithoutExtension(file.FileName),
                Description = description,
                SourceFile = Path.GetFileName(modelFile),
                Format = PointCloudFormat.ept,
                CreatedAt = DateTime.UtcNow
            };

            // Save metadata
            var metadataPath = Path.Combine(outputDir, "metadata.json");
            await File.WriteAllTextAsync(
                metadataPath,
                System.Text.Json.JsonSerializer.Serialize(metadata, new System.Text.Json.JsonSerializerOptions
                {
                    WriteIndented = true
                }),
                cancellationToken);

            _logger.LogInformation("Successfully processed upload for model {ModelId}", modelId);

            return metadata;
        }
        finally
        {
            // Cleanup temporary directory
            if (Directory.Exists(tempDir))
            {
                Directory.Delete(tempDir, true);
            }
        }
    }

    private void ValidateFile(IFormFile file)
    {
        if (file == null || file.Length == 0)
        {
            throw new ArgumentException("File is required");
        }

        var extension = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (!_uploadSettings.AllowedExtensions.Contains(extension))
        {
            throw new ArgumentException($"File type {extension} is not allowed");
        }

        var maxSizeBytes = _uploadSettings.MaxFileSizeMB * 1024 * 1024;
        if (file.Length > maxSizeBytes)
        {
            throw new ArgumentException($"File size exceeds maximum of {_uploadSettings.MaxFileSizeMB}MB");
        }
    }

    private string GenerateModelId(string fileName)
    {
        var baseName = Path.GetFileNameWithoutExtension(fileName)
            .ToLowerInvariant()
            .Replace(" ", "-")
            .Replace("_", "-");

        // Remove special characters
        baseName = new string(baseName.Where(c => char.IsLetterOrDigit(c) || c == '-').ToArray());

        // Add timestamp to ensure uniqueness
        var timestamp = DateTime.UtcNow.ToString("yyyyMMddHHmmss");

        return $"{baseName}-{timestamp}";
    }

    private string? FindModelFile(string directory)
    {
        var supportedExtensions = new[]
        {
            ".obj", ".fbx", ".gltf", ".glb", ".stl", ".ply", ".3ds", ".dae", ".blend"
        };

        foreach (var file in Directory.GetFiles(directory, "*.*", SearchOption.AllDirectories))
        {
            var extension = Path.GetExtension(file).ToLowerInvariant();
            if (supportedExtensions.Contains(extension))
            {
                return file;
            }
        }

        return null;
    }

    private async Task RunModelParserAsync(string inputFile, string outputDir, CancellationToken cancellationToken)
    {
        var startInfo = new ProcessStartInfo
        {
            FileName = _parserSettings.ExecutablePath,
            Arguments = $"-i \"{inputFile}\" -o \"{outputDir}\" --format ept --point-count {_parserSettings.DefaultPointCount}",
            UseShellExecute = false,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            CreateNoWindow = true
        };

        _logger.LogInformation("Running model parser: {FileName} {Arguments}", startInfo.FileName, startInfo.Arguments);

        using var process = new Process { StartInfo = startInfo };

        var outputBuilder = new System.Text.StringBuilder();
        var errorBuilder = new System.Text.StringBuilder();

        process.OutputDataReceived += (sender, e) =>
        {
            if (e.Data != null)
            {
                outputBuilder.AppendLine(e.Data);
                _logger.LogDebug("Parser output: {Output}", e.Data);
            }
        };

        process.ErrorDataReceived += (sender, e) =>
        {
            if (e.Data != null)
            {
                errorBuilder.AppendLine(e.Data);
                _logger.LogWarning("Parser error: {Error}", e.Data);
            }
        };

        process.Start();
        process.BeginOutputReadLine();
        process.BeginErrorReadLine();

        await process.WaitForExitAsync(cancellationToken);

        if (process.ExitCode != 0)
        {
            var error = errorBuilder.ToString();
            _logger.LogError("Model parser failed with exit code {ExitCode}: {Error}", process.ExitCode, error);
            throw new InvalidOperationException($"Model parser failed: {error}");
        }

        _logger.LogInformation("Model parser completed successfully");
    }
}
