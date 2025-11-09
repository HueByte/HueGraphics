use serde::{Deserialize, Serialize};

/// Configuration for point cloud generation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PointCloudConfig {
    /// Number of points to generate
    pub point_count: usize,

    /// Sampling strategy
    pub sampling_strategy: SamplingStrategy,

    /// Include vertex normals in output
    pub include_normals: bool,

    /// Include vertex colors in output
    pub include_colors: bool,

    /// Scale factor for the model
    pub scale: f32,

    /// Add random jitter to points (0.0 = no jitter, 1.0 = maximum jitter)
    pub jitter: f32,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub enum SamplingStrategy {
    /// Sample points uniformly across the surface
    Uniform,

    /// Sample points based on triangle area (more points on larger triangles)
    AreaWeighted,

    /// Use only mesh vertices
    Vertices,
}

impl Default for PointCloudConfig {
    fn default() -> Self {
        Self {
            point_count: 2000,
            sampling_strategy: SamplingStrategy::AreaWeighted,
            include_normals: true,
            include_colors: true,
            scale: 1.0,
            jitter: 0.0,
        }
    }
}

impl PointCloudConfig {
    pub fn new(point_count: usize) -> Self {
        Self {
            point_count,
            ..Default::default()
        }
    }

    pub fn with_strategy(mut self, strategy: SamplingStrategy) -> Self {
        self.sampling_strategy = strategy;
        self
    }

    pub fn with_normals(mut self, include: bool) -> Self {
        self.include_normals = include;
        self
    }

    pub fn with_colors(mut self, include: bool) -> Self {
        self.include_colors = include;
        self
    }

    pub fn with_scale(mut self, scale: f32) -> Self {
        self.scale = scale;
        self
    }

    pub fn with_jitter(mut self, jitter: f32) -> Self {
        self.jitter = jitter.clamp(0.0, 1.0);
        self
    }
}
