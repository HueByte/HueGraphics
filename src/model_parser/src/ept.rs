use crate::{point_cloud::PointCloud, error::Result};
use glam::Vec3;
use rayon::prelude::*;
use serde::{Deserialize, Serialize};
use std::path::Path;

/// EPT (Entwine Point Tile) format support
/// This is a simplified EPT implementation optimized for web streaming

/// EPT Metadata structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EptMetadata {
    /// Bounds of the entire point cloud
    pub bounds: [f64; 6], // [minx, miny, minz, maxx, maxy, maxz]

    /// Conforming bounds (actual data extent)
    pub bounds_conforming: [f64; 6],

    /// Total number of points
    pub points: u64,

    /// Data type for each dimension
    pub schema: Vec<EptDimension>,

    /// Spatial reference system
    pub srs: EptSrs,

    /// Data type (laszip or binary)
    #[serde(rename = "dataType")]
    pub data_type: String,

    /// Hierarchy type
    #[serde(rename = "hierarchyType")]
    pub hierarchy_type: String,

    /// Octree span (size of root node)
    pub span: u32,

    /// Version
    pub version: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EptDimension {
    pub name: String,
    #[serde(rename = "type")]
    pub data_type: String,
    pub size: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EptSrs {
    pub authority: String,
    pub horizontal: String,
    pub vertical: String,
    #[serde(rename = "wkt")]
    pub wkt: String,
}

/// Octree node key for EPT hierarchy
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct OctreeKey {
    pub depth: u32,
    pub x: u32,
    pub y: u32,
    pub z: u32,
}

impl OctreeKey {
    pub fn new(depth: u32, x: u32, y: u32, z: u32) -> Self {
        Self { depth, x, y, z }
    }

    pub fn root() -> Self {
        Self::new(0, 0, 0, 0)
    }

    /// Get the 8 child keys
    pub fn children(&self) -> [OctreeKey; 8] {
        let d = self.depth + 1;
        let x = self.x * 2;
        let y = self.y * 2;
        let z = self.z * 2;

        [
            OctreeKey::new(d, x,     y,     z    ),
            OctreeKey::new(d, x + 1, y,     z    ),
            OctreeKey::new(d, x,     y + 1, z    ),
            OctreeKey::new(d, x + 1, y + 1, z    ),
            OctreeKey::new(d, x,     y,     z + 1),
            OctreeKey::new(d, x + 1, y,     z + 1),
            OctreeKey::new(d, x,     y + 1, z + 1),
            OctreeKey::new(d, x + 1, y + 1, z + 1),
        ]
    }

    /// Convert to EPT file path format (D-X-Y-Z.json)
    pub fn to_path_string(&self) -> String {
        format!("{}-{}-{}-{}", self.depth, self.x, self.y, self.z)
    }
}

/// Binary point data for EPT tiles
#[derive(Debug, Clone)]
pub struct EptPointData {
    pub positions: Vec<[f32; 3]>,
    pub colors: Option<Vec<[u8; 3]>>,
    pub normals: Option<Vec<[f32; 3]>>,
}

pub struct EptBuilder {
    max_points_per_tile: usize,
    max_depth: u32,
}

impl Default for EptBuilder {
    fn default() -> Self {
        Self {
            max_points_per_tile: 100_000, // Standard EPT default
            max_depth: 10,
        }
    }
}

impl EptBuilder {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn with_max_points_per_tile(mut self, max_points: usize) -> Self {
        self.max_points_per_tile = max_points;
        self
    }

    pub fn with_max_depth(mut self, depth: u32) -> Self {
        self.max_depth = depth;
        self
    }

    /// Build EPT structure from point cloud
    pub fn build(&self, point_cloud: &PointCloud, output_dir: &Path) -> Result<()> {
        // Create output directory structure
        std::fs::create_dir_all(output_dir)?;
        std::fs::create_dir_all(output_dir.join("ept-data"))?;
        std::fs::create_dir_all(output_dir.join("ept-hierarchy"))?;

        // Calculate bounds
        let bounds = self.calculate_bounds(&point_cloud.points);
        let bounds_conforming = bounds.clone();

        // Create schema based on available data
        let mut schema = vec![
            EptDimension {
                name: "X".to_string(),
                data_type: "floating".to_string(),
                size: 4,
            },
            EptDimension {
                name: "Y".to_string(),
                data_type: "floating".to_string(),
                size: 4,
            },
            EptDimension {
                name: "Z".to_string(),
                data_type: "floating".to_string(),
                size: 4,
            },
        ];

        if point_cloud.metadata.has_colors {
            schema.push(EptDimension {
                name: "Red".to_string(),
                data_type: "unsigned".to_string(),
                size: 1,
            });
            schema.push(EptDimension {
                name: "Green".to_string(),
                data_type: "unsigned".to_string(),
                size: 1,
            });
            schema.push(EptDimension {
                name: "Blue".to_string(),
                data_type: "unsigned".to_string(),
                size: 1,
            });
        }

        if point_cloud.metadata.has_normals {
            schema.push(EptDimension {
                name: "NormalX".to_string(),
                data_type: "floating".to_string(),
                size: 4,
            });
            schema.push(EptDimension {
                name: "NormalY".to_string(),
                data_type: "floating".to_string(),
                size: 4,
            });
            schema.push(EptDimension {
                name: "NormalZ".to_string(),
                data_type: "floating".to_string(),
                size: 4,
            });
        }

        // Create metadata
        let metadata = EptMetadata {
            bounds,
            bounds_conforming,
            points: point_cloud.points.len() as u64,
            schema,
            srs: EptSrs {
                authority: "EPSG".to_string(),
                horizontal: "4978".to_string(), // ECEF
                vertical: "".to_string(),
                wkt: "".to_string(),
            },
            data_type: "binary".to_string(),
            hierarchy_type: "json".to_string(),
            span: 128, // Standard span
            version: "1.0.0".to_string(),
        };

        // Write metadata
        let metadata_json = serde_json::to_string_pretty(&metadata)?;
        std::fs::write(output_dir.join("ept.json"), metadata_json)?;

        // Build octree and write tiles
        self.build_octree(point_cloud, output_dir, &metadata)?;

        Ok(())
    }

    fn calculate_bounds(&self, points: &[crate::point_cloud::Point]) -> [f64; 6] {
        if points.is_empty() {
            return [0.0, 0.0, 0.0, 0.0, 0.0, 0.0];
        }

        // Parallel min/max calculation using reduce
        let (min, max) = points
            .par_iter()
            .map(|point| {
                let pos = Vec3::from(point.position);
                (pos, pos)
            })
            .reduce(
                || (Vec3::splat(f32::MAX), Vec3::splat(f32::MIN)),
                |(min_a, max_a), (min_b, max_b)| (min_a.min(min_b), max_a.max(max_b)),
            );

        // Add small padding
        let padding = (max - min).length() * 0.01;
        let min = min - Vec3::splat(padding);
        let max = max + Vec3::splat(padding);

        [
            min.x as f64, min.y as f64, min.z as f64,
            max.x as f64, max.y as f64, max.z as f64,
        ]
    }

    fn build_octree(
        &self,
        point_cloud: &PointCloud,
        output_dir: &Path,
        _metadata: &EptMetadata,
    ) -> Result<()> {
        use std::collections::HashMap;

        // Simple implementation: write all points to root node for now
        // In production, you'd recursively split into octree tiles

        let root_key = OctreeKey::root();

        // Prepare point data in parallel
        let has_colors = point_cloud.metadata.has_colors;
        let has_normals = point_cloud.metadata.has_normals;

        let data: Vec<_> = point_cloud
            .points
            .par_iter()
            .map(|point| {
                let position = point.position;

                let color = if has_colors {
                    if let Some(color) = point.color {
                        // Convert from 0-1 float to 0-255 u8
                        [
                            (color[0] * 255.0) as u8,
                            (color[1] * 255.0) as u8,
                            (color[2] * 255.0) as u8,
                        ]
                    } else {
                        [255, 255, 255]
                    }
                } else {
                    [0, 0, 0] // Dummy value, won't be used
                };

                let normal = if has_normals {
                    point.normal.unwrap_or([0.0, 0.0, 0.0])
                } else {
                    [0.0, 0.0, 0.0] // Dummy value, won't be used
                };

                (position, color, normal)
            })
            .collect();

        // Unzip into separate vectors
        let mut positions = Vec::with_capacity(data.len());
        let mut color_data = Vec::with_capacity(data.len());
        let mut normal_data = Vec::with_capacity(data.len());

        for (pos, col, norm) in data {
            positions.push(pos);
            color_data.push(col);
            normal_data.push(norm);
        }

        let colors = if has_colors { Some(color_data) } else { None };
        let normals = if has_normals { Some(normal_data) } else { None };

        // Write binary tile data
        let tile_path = output_dir.join("ept-data").join(format!("{}.bin", root_key.to_path_string()));
        self.write_binary_tile(&tile_path, &positions, colors.as_ref(), normals.as_ref())?;

        // Write hierarchy
        let mut hierarchy = HashMap::new();
        hierarchy.insert(root_key.to_path_string(), point_cloud.points.len() as i64);

        let hierarchy_json = serde_json::to_string_pretty(&hierarchy)?;
        let hierarchy_path = output_dir.join("ept-hierarchy").join("0-0-0-0.json");
        std::fs::write(hierarchy_path, hierarchy_json)?;

        Ok(())
    }

    fn write_binary_tile(
        &self,
        path: &Path,
        positions: &[[f32; 3]],
        colors: Option<&Vec<[u8; 3]>>,
        normals: Option<&Vec<[f32; 3]>>,
    ) -> Result<()> {
        use std::io::Write;

        let mut file = std::fs::File::create(path)?;

        // Write point data in binary format
        for (i, pos) in positions.iter().enumerate() {
            // Write position (3 x f32)
            file.write_all(&pos[0].to_le_bytes())?;
            file.write_all(&pos[1].to_le_bytes())?;
            file.write_all(&pos[2].to_le_bytes())?;

            // Write color if present (3 x u8)
            if let Some(color_vec) = colors {
                let color = color_vec[i];
                file.write_all(&[color[0], color[1], color[2]])?;
            }

            // Write normal if present (3 x f32)
            if let Some(normal_vec) = normals {
                let normal = normal_vec[i];
                file.write_all(&normal[0].to_le_bytes())?;
                file.write_all(&normal[1].to_le_bytes())?;
                file.write_all(&normal[2].to_le_bytes())?;
            }
        }

        Ok(())
    }
}
