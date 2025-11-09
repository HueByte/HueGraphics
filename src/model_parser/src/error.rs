use thiserror::Error;

#[derive(Error, Debug)]
pub enum ModelParserError {
    #[error("Failed to read file: {0}")]
    FileReadError(#[from] std::io::Error),

    #[error("Failed to parse GLTF: {0}")]
    GltfError(#[from] gltf::Error),

    #[error("Unsupported file format: {0}")]
    UnsupportedFormat(String),

    #[error("No mesh data found in model")]
    NoMeshData,

    #[error("Invalid point count: {0}")]
    InvalidPointCount(usize),

    #[error("Serialization error: {0}")]
    SerializationError(#[from] serde_json::Error),
}

pub type Result<T> = std::result::Result<T, ModelParserError>;
