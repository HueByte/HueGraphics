# Model Parser

A Rust-based tool for converting 3D models into point cloud data optimized for web visualization.

## Features

- **3D Model Support**: Currently supports GLTF/GLB formats
- **Configurable Sampling**: Multiple sampling strategies (uniform, area-weighted, vertex-based)
- **Customizable Output**: Control point count, normals, colors, scale, and jitter
- **JSON Export**: Outputs point cloud data in JSON format for easy client-side parsing
- **CLI Interface**: Easy-to-use command-line tool

## Installation

Build the project:

```bash
cd src/model_parser
cargo build --release
```

The binary will be available at `target/release/model_parser` (or `model_parser.exe` on Windows).

## Usage

### Basic Usage

```bash
model_parser --input model.glb --output pointcloud.json
```

### Advanced Options

```bash
model_parser \
  --input model.glb \
  --output pointcloud.json \
  --point-count 5000 \
  --strategy area-weighted \
  --scale 2.0 \
  --jitter 0.1 \
  --normals \
  --colors
```

### Options

- `-i, --input <FILE>` - Input 3D model file (GLTF/GLB)
- `-o, --output <FILE>` - Output JSON file
- `-n, --point-count <NUMBER>` - Number of points to generate (default: 2000)
- `-s, --strategy <STRATEGY>` - Sampling strategy: `uniform`, `area-weighted`, or `vertices` (default: area-weighted)
- `--normals` - Include vertex normals (default: true)
- `--colors` - Include vertex colors (default: true)
- `--scale <FACTOR>` - Scale factor for the model (default: 1.0)
- `-j, --jitter <AMOUNT>` - Jitter amount 0.0-1.0 (default: 0.0)

## Sampling Strategies

### Area-Weighted (Recommended)
Distributes points based on triangle surface area. Larger triangles get more points, resulting in uniform visual density.

### Uniform
Each triangle has equal probability of being sampled, regardless of size.

### Vertices
Uses only the original mesh vertices (limited to mesh vertex count).

## Output Format

The tool generates a JSON file with the following structure:

```json
{
  "metadata": {
    "point_count": 2000,
    "bounds_min": [-1.0, -1.0, -1.0],
    "bounds_max": [1.0, 1.0, 1.0],
    "source_file": "model.glb",
    "has_normals": true,
    "has_colors": true
  },
  "points": [
    {
      "position": [0.5, 0.3, -0.2],
      "normal": [0.0, 1.0, 0.0],
      "color": [0.8, 0.2, 0.4]
    }
  ]
}
```

## Library Usage

You can also use this as a library in your Rust projects:

```rust
use model_parser::{ModelParser, PointCloudConfig, SamplingStrategy};
use std::path::Path;

let config = PointCloudConfig::new(2000)
    .with_strategy(SamplingStrategy::AreaWeighted)
    .with_scale(2.0);

let point_cloud = ModelParser::parse_file(
    Path::new("model.glb"),
    &config
)?;

point_cloud.save_to_file(Path::new("output.json"))?;
```

## Supported Formats

Currently supported:
- GLTF (.gltf)
- GLB (.glb)

Planned:
- FBX (.fbx)
- OBJ (.obj)
- Blender (.blend) - via export to GLTF

## Converting from Blender

To use Blender files, export them to GLTF/GLB first:

1. In Blender: File → Export → glTF 2.0
2. Choose GLB format for a single file
3. Run model_parser on the exported file

## Performance

- Typical parsing time: < 1 second for models with 10k-100k vertices
- Memory usage scales linearly with point count
- Recommended point count: 2000-10000 for web visualization

## Examples

Generate a dense point cloud with jitter:
```bash
model_parser -i bunny.glb -o bunny_points.json -n 10000 -j 0.05
```

Extract only vertices without normals:
```bash
model_parser -i model.glb -o vertices.json -s vertices --normals=false
```

Scale up a small model:
```bash
model_parser -i tiny_model.glb -o scaled.json --scale 10.0
```
