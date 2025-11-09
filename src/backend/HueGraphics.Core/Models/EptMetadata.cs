using System.Text.Json.Serialization;

namespace HueGraphics.Core.Models;

public class EptMetadata
{
    [JsonPropertyName("bounds")]
    public required double[] Bounds { get; set; }              // [minx, miny, minz, maxx, maxy, maxz]

    [JsonPropertyName("bounds_conforming")]
    public required double[] BoundsConforming { get; set; }

    [JsonPropertyName("points")]
    public long Points { get; set; }

    [JsonPropertyName("schema")]
    public required List<EptDimension> Schema { get; set; }

    [JsonPropertyName("srs")]
    public required EptSrs Srs { get; set; }

    [JsonPropertyName("dataType")]
    public string DataType { get; set; } = "binary";

    [JsonPropertyName("hierarchyType")]
    public string HierarchyType { get; set; } = "json";

    [JsonPropertyName("span")]
    public int Span { get; set; } = 128;

    [JsonPropertyName("version")]
    public string Version { get; set; } = "1.0.0";
}

public class EptDimension
{
    [JsonPropertyName("name")]
    public required string Name { get; set; }

    [JsonPropertyName("type")]
    public required string Type { get; set; }

    [JsonPropertyName("size")]
    public int Size { get; set; }
}

public class EptSrs
{
    [JsonPropertyName("authority")]
    public string Authority { get; set; } = "EPSG";

    [JsonPropertyName("horizontal")]
    public string Horizontal { get; set; } = "4978";

    [JsonPropertyName("vertical")]
    public string Vertical { get; set; } = "";

    [JsonPropertyName("wkt")]
    public string Wkt { get; set; } = "";
}
