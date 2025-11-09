namespace HueGraphics.Core.Models;

public class ProcessingStatus
{
    public required string Id { get; set; }
    public required string Status { get; set; } // "pending", "processing", "completed", "failed"
    public int Progress { get; set; } // 0-100
    public string? ErrorMessage { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? CompletedAt { get; set; }
}

public enum ModelProcessingState
{
    Pending,
    Processing,
    Completed,
    Failed
}
