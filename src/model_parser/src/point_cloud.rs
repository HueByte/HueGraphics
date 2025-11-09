use serde::{Deserialize, Serialize};
use glam::Vec3;

/// Represents a single point in the point cloud
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Point {
    /// Position in 3D space [x, y, z]
    pub position: [f32; 3],

    /// Normal vector [x, y, z] (optional)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub normal: Option<[f32; 3]>,

    /// Color [r, g, b] (optional, values 0.0-1.0)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub color: Option<[f32; 3]>,
}

impl Point {
    pub fn new(position: Vec3) -> Self {
        Self {
            position: position.to_array(),
            normal: None,
            color: None,
        }
    }

    pub fn with_normal(mut self, normal: Vec3) -> Self {
        self.normal = Some(normal.to_array());
        self
    }

    pub fn with_color(mut self, color: Vec3) -> Self {
        self.color = Some(color.to_array());
        self
    }
}

/// Point cloud data structure optimized for JSON serialization
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PointCloud {
    /// Array of points
    pub points: Vec<Point>,

    /// Metadata about the point cloud
    pub metadata: PointCloudMetadata,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PointCloudMetadata {
    /// Total number of points
    pub point_count: usize,

    /// Bounding box minimum coordinates [x, y, z]
    pub bounds_min: [f32; 3],

    /// Bounding box maximum coordinates [x, y, z]
    pub bounds_max: [f32; 3],

    /// Source file name
    pub source_file: String,

    /// Whether normals are included
    pub has_normals: bool,

    /// Whether colors are included
    pub has_colors: bool,
}

impl PointCloud {
    pub fn new(points: Vec<Point>, source_file: String) -> Self {
        let bounds = Self::calculate_bounds(&points);
        let has_normals = points.iter().any(|p| p.normal.is_some());
        let has_colors = points.iter().any(|p| p.color.is_some());

        Self {
            metadata: PointCloudMetadata {
                point_count: points.len(),
                bounds_min: bounds.0,
                bounds_max: bounds.1,
                source_file,
                has_normals,
                has_colors,
            },
            points,
        }
    }

    fn calculate_bounds(points: &[Point]) -> ([f32; 3], [f32; 3]) {
        if points.is_empty() {
            return ([0.0, 0.0, 0.0], [0.0, 0.0, 0.0]);
        }

        let mut min = Vec3::from(points[0].position);
        let mut max = Vec3::from(points[0].position);

        for point in points.iter().skip(1) {
            let pos = Vec3::from(point.position);
            min = min.min(pos);
            max = max.max(pos);
        }

        (min.to_array(), max.to_array())
    }

    /// Save point cloud to JSON file
    pub fn save_to_file(&self, path: &std::path::Path) -> crate::error::Result<()> {
        let json = serde_json::to_string_pretty(self)?;
        std::fs::write(path, json)?;
        Ok(())
    }

    /// Load point cloud from JSON file
    pub fn load_from_file(path: &std::path::Path) -> crate::error::Result<Self> {
        let json = std::fs::read_to_string(path)?;
        let point_cloud = serde_json::from_str(&json)?;
        Ok(point_cloud)
    }
}
