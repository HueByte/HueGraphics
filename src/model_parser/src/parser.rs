use crate::{
    config::{PointCloudConfig, SamplingStrategy},
    error::{ModelParserError, Result},
    point_cloud::{Point, PointCloud},
};
use glam::Vec3;
use rand::Rng;
use std::path::Path;

pub struct ModelParser;

impl ModelParser {
    /// Parse a 3D model file and generate a point cloud
    pub fn parse_file(path: &Path, config: &PointCloudConfig) -> Result<PointCloud> {
        let extension = path
            .extension()
            .and_then(|e| e.to_str())
            .ok_or_else(|| ModelParserError::UnsupportedFormat("no extension".to_string()))?;

        match extension.to_lowercase().as_str() {
            "gltf" | "glb" => Self::parse_gltf(path, config),
            ext => Err(ModelParserError::UnsupportedFormat(format!(
                "{} (currently only GLTF/GLB supported)",
                ext
            ))),
        }
    }

    /// Parse GLTF/GLB file
    fn parse_gltf(path: &Path, config: &PointCloudConfig) -> Result<PointCloud> {
        let (document, buffers, _) = gltf::import(path)?;

        let mut all_vertices = Vec::new();
        let mut all_normals = Vec::new();
        let mut all_colors = Vec::new();
        let mut all_indices = Vec::new();

        // Extract mesh data
        for mesh in document.meshes() {
            for primitive in mesh.primitives() {
                let reader = primitive.reader(|buffer| Some(&buffers[buffer.index()]));

                // Read positions
                if let Some(positions) = reader.read_positions() {
                    let base_index = all_vertices.len();
                    all_vertices.extend(positions.map(Vec3::from));

                    // Read normals if available and requested
                    if config.include_normals {
                        if let Some(normals) = reader.read_normals() {
                            all_normals.extend(normals.map(Vec3::from));
                        } else {
                            // Pad with zero normals if not available
                            all_normals.resize(all_vertices.len(), Vec3::ZERO);
                        }
                    }

                    // Read colors if available and requested
                    if config.include_colors {
                        if let Some(colors) = reader.read_colors(0) {
                            all_colors.extend(colors.into_rgb_f32().map(Vec3::from));
                        } else {
                            // Default white color
                            all_colors.resize(all_vertices.len(), Vec3::ONE);
                        }
                    }

                    // Read indices for triangle-based sampling
                    if let Some(indices) = reader.read_indices() {
                        all_indices.extend(indices.into_u32().map(|i| (i as usize) + base_index));
                    }
                }
            }
        }

        if all_vertices.is_empty() {
            return Err(ModelParserError::NoMeshData);
        }

        // Generate point cloud based on sampling strategy
        let points = Self::generate_point_cloud(
            &all_vertices,
            &all_normals,
            &all_colors,
            &all_indices,
            config,
        );

        let source_file = path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("unknown")
            .to_string();

        Ok(PointCloud::new(points, source_file))
    }

    fn generate_point_cloud(
        vertices: &[Vec3],
        normals: &[Vec3],
        colors: &[Vec3],
        indices: &[usize],
        config: &PointCloudConfig,
    ) -> Vec<Point> {
        let mut rng = rand::thread_rng();
        let has_normals = !normals.is_empty();
        let has_colors = !colors.is_empty();

        match config.sampling_strategy {
            SamplingStrategy::Vertices => {
                // Use existing vertices
                vertices
                    .iter()
                    .take(config.point_count)
                    .enumerate()
                    .map(|(i, &pos)| {
                        let scaled_pos = pos * config.scale;
                        let mut point = Point::new(scaled_pos);

                        if has_normals && config.include_normals && i < normals.len() {
                            point = point.with_normal(normals[i]);
                        }

                        if has_colors && config.include_colors && i < colors.len() {
                            point = point.with_color(colors[i]);
                        }

                        point
                    })
                    .collect()
            }

            SamplingStrategy::Uniform | SamplingStrategy::AreaWeighted => {
                let mut points = Vec::with_capacity(config.point_count);

                if indices.len() >= 3 {
                    // Sample from triangles
                    let triangles: Vec<_> = indices.chunks(3).collect();

                    let triangle_weights = if matches!(config.sampling_strategy, SamplingStrategy::AreaWeighted) {
                        // Calculate triangle areas for weighted sampling
                        triangles
                            .iter()
                            .map(|tri| {
                                if tri.len() == 3 {
                                    let v0 = vertices[tri[0]];
                                    let v1 = vertices[tri[1]];
                                    let v2 = vertices[tri[2]];
                                    let area = (v1 - v0).cross(v2 - v0).length() * 0.5;
                                    area
                                } else {
                                    0.0
                                }
                            })
                            .collect::<Vec<_>>()
                    } else {
                        vec![1.0; triangles.len()]
                    };

                    let total_weight: f32 = triangle_weights.iter().sum();

                    for _ in 0..config.point_count {
                        // Select random triangle (weighted by area if needed)
                        let mut weight_select = rng.gen::<f32>() * total_weight;
                        let mut selected_tri = 0;

                        for (i, &weight) in triangle_weights.iter().enumerate() {
                            weight_select -= weight;
                            if weight_select <= 0.0 {
                                selected_tri = i;
                                break;
                            }
                        }

                        let tri = triangles[selected_tri];
                        if tri.len() != 3 {
                            continue;
                        }

                        // Random barycentric coordinates
                        let r1 = rng.gen::<f32>().sqrt();
                        let r2 = rng.gen::<f32>();
                        let a = 1.0 - r1;
                        let b = r1 * (1.0 - r2);
                        let c = r1 * r2;

                        let v0 = vertices[tri[0]];
                        let v1 = vertices[tri[1]];
                        let v2 = vertices[tri[2]];

                        let mut pos = v0 * a + v1 * b + v2 * c;

                        // Apply jitter
                        if config.jitter > 0.0 {
                            let jitter_amount = config.jitter * 0.1;
                            pos.x += rng.gen_range(-jitter_amount..jitter_amount);
                            pos.y += rng.gen_range(-jitter_amount..jitter_amount);
                            pos.z += rng.gen_range(-jitter_amount..jitter_amount);
                        }

                        let scaled_pos = pos * config.scale;
                        let mut point = Point::new(scaled_pos);

                        if has_normals && config.include_normals {
                            let n0 = normals[tri[0]];
                            let n1 = normals[tri[1]];
                            let n2 = normals[tri[2]];
                            let normal = (n0 * a + n1 * b + n2 * c).normalize();
                            point = point.with_normal(normal);
                        }

                        if has_colors && config.include_colors {
                            let c0 = colors[tri[0]];
                            let c1 = colors[tri[1]];
                            let c2 = colors[tri[2]];
                            let color = c0 * a + c1 * b + c2 * c;
                            point = point.with_color(color);
                        }

                        points.push(point);
                    }
                } else {
                    // Fallback to vertex sampling
                    for _ in 0..config.point_count {
                        let idx = rng.gen_range(0..vertices.len());
                        let mut pos = vertices[idx];

                        // Apply jitter
                        if config.jitter > 0.0 {
                            let jitter_amount = config.jitter * 0.1;
                            pos.x += rng.gen_range(-jitter_amount..jitter_amount);
                            pos.y += rng.gen_range(-jitter_amount..jitter_amount);
                            pos.z += rng.gen_range(-jitter_amount..jitter_amount);
                        }

                        let scaled_pos = pos * config.scale;
                        let mut point = Point::new(scaled_pos);

                        if has_normals && config.include_normals && idx < normals.len() {
                            point = point.with_normal(normals[idx]);
                        }

                        if has_colors && config.include_colors && idx < colors.len() {
                            point = point.with_color(colors[idx]);
                        }

                        points.push(point);
                    }
                }

                points
            }
        }
    }
}
