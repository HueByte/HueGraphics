namespace HueGraphics.Domain.Settings;

public class UploadSettings
{
    public string ApiKey { get; set; } = string.Empty;
    public int MaxFileSizeMB { get; set; } = 100;
    public string[] AllowedExtensions { get; set; } = new[] { ".zip" };
    public string UploadPath { get; set; } = "uploads";
}
