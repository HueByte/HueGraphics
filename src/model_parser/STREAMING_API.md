# Streaming Point Clouds from Rust API

This guide shows how to serve EPT point cloud data from a Rust API to your React client.

## Architecture

```
3D Model (GLTF/GLB)
    ↓
model_parser CLI (generates EPT)
    ↓
EPT Directory Structure
    ├── ept.json (metadata)
    ├── ept-data/ (binary tiles)
    └── ept-hierarchy/ (octree structure)
    ↓
Rust API Server (serves tiles)
    ↓
React Client (loads & renders)
```

## Step 1: Generate EPT Data

```bash
# Convert your 3D model to EPT format
model_parser \
  --input model.glb \
  --output ./ept-output \
  --format ept \
  --point-count 100000 \
  --strategy area-weighted
```

## Step 2: Create Rust API Server

### Dependencies (Cargo.toml)

```toml
[package]
name = "pointcloud_server"
version = "0.1.0"
edition = "2021"

[dependencies]
axum = "0.7"
tokio = { version = "1", features = ["full"] }
tower = "0.4"
tower-http = { version = "0.5", features = ["fs", "cors"] }
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
```

### Server Implementation (main.rs)

```rust
use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    routing::get,
    Json, Router,
};
use std::{net::SocketAddr, path::PathBuf, sync::Arc};
use tower_http::{cors::CorsLayer, services::ServeDir};

#[derive(Clone)]
struct AppState {
    ept_base_path: PathBuf,
}

#[tokio::main]
async fn main() {
    // Configure EPT data directory
    let ept_base_path = PathBuf::from("./ept-output");

    let state = Arc::new(AppState { ept_base_path });

    // Build router
    let app = Router::new()
        // EPT metadata endpoint
        .route("/api/pointcloud/:id/ept.json", get(get_ept_metadata))
        // Tile data endpoints
        .route("/api/pointcloud/:id/ept-data/:tile", get(get_ept_tile))
        .route("/api/pointcloud/:id/ept-hierarchy/:tile", get(get_ept_hierarchy))
        // Static files for client
        .nest_service("/", ServeDir::new("../client/dist"))
        .layer(CorsLayer::permissive())
        .with_state(state);

    // Start server
    let addr = SocketAddr::from(([127, 0, 0, 1], 3000));
    println!("Server running on http://{}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}

/// Serve EPT metadata
async fn get_ept_metadata(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    let path = state.ept_base_path.join(&id).join("ept.json");

    match tokio::fs::read_to_string(path).await {
        Ok(content) => (StatusCode::OK, content),
        Err(_) => (StatusCode::NOT_FOUND, "Not found".to_string()),
    }
}

/// Serve EPT tile data (binary)
async fn get_ept_tile(
    State(state): State<Arc<AppState>>,
    Path((id, tile)): Path<(String, String)>,
) -> impl IntoResponse {
    let path = state.ept_base_path
        .join(&id)
        .join("ept-data")
        .join(&tile);

    match tokio::fs::read(path).await {
        Ok(content) => (StatusCode::OK, content),
        Err(_) => (StatusCode::NOT_FOUND, Vec::new()),
    }
}

/// Serve EPT hierarchy (JSON)
async fn get_ept_hierarchy(
    State(state): State<Arc<AppState>>,
    Path((id, tile)): Path<(String, String)>,
) -> impl IntoResponse {
    let path = state.ept_base_path
        .join(&id)
        .join("ept-hierarchy")
        .join(&tile);

    match tokio::fs::read_to_string(path).await {
        Ok(content) => (StatusCode::OK, content),
        Err(_) => (StatusCode::NOT_FOUND, "Not found".to_string()),
    }
}
```

## Step 3: Client-Side EPT Loader

### Install EPT Loader

```bash
cd src/client
npm install three @loaders.gl/core @loaders.gl/las
```

### EPT Loader Component (React + Three.js)

```javascript
import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';

const EPTPointCloudViewer = ({ pointCloudId }) => {
  const containerRef = useRef(null);
  const sceneRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Scene setup
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      75,
      containerRef.current.clientWidth / containerRef.current.clientHeight,
      0.1,
      1000
    );
    camera.position.z = 5;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(
      containerRef.current.clientWidth,
      containerRef.current.clientHeight
    );
    containerRef.current.appendChild(renderer.domElement);

    // Load EPT metadata
    loadEPTPointCloud(scene, pointCloudId);

    // Animation loop
    function animate() {
      requestAnimationFrame(animate);
      scene.rotation.y += 0.001;
      renderer.render(scene, camera);
    }
    animate();

    // Cleanup
    return () => {
      containerRef.current?.removeChild(renderer.domElement);
      renderer.dispose();
    };
  }, [pointCloudId]);

  async function loadEPTPointCloud(scene, id) {
    // Fetch EPT metadata
    const metadataResponse = await fetch(`/api/pointcloud/${id}/ept.json`);
    const metadata = await metadataResponse.json();

    console.log('EPT Metadata:', metadata);

    // Load root tile
    const rootTile = '0-0-0-0';
    const tileResponse = await fetch(`/api/pointcloud/${id}/ept-data/${rootTile}.bin`);
    const tileData = await tileResponse.arrayBuffer();

    // Parse binary point data
    const points = parseBinaryTile(tileData, metadata);

    // Create Three.js point cloud
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(points.positions);
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    if (points.colors) {
      const colors = new Float32Array(points.colors);
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    }

    const material = new THREE.PointsMaterial({
      size: 0.05,
      vertexColors: !!points.colors,
    });

    const pointCloud = new THREE.Points(geometry, material);
    scene.add(pointCloud);

    // Center and scale
    geometry.computeBoundingBox();
    const center = new THREE.Vector3();
    geometry.boundingBox.getCenter(center);
    pointCloud.position.sub(center);
  }

  function parseBinaryTile(buffer, metadata) {
    const view = new DataView(buffer);
    const pointCount = buffer.byteLength / getPointSize(metadata);

    const positions = [];
    const colors = [];
    let offset = 0;

    const hasColors = metadata.schema.some(d => d.name === 'Red');

    for (let i = 0; i < pointCount; i++) {
      // Read position (3 x f32)
      const x = view.getFloat32(offset, true); offset += 4;
      const y = view.getFloat32(offset, true); offset += 4;
      const z = view.getFloat32(offset, true); offset += 4;
      positions.push(x, y, z);

      // Read color if present (3 x u8)
      if (hasColors) {
        const r = view.getUint8(offset++) / 255;
        const g = view.getUint8(offset++) / 255;
        const b = view.getUint8(offset++) / 255;
        colors.push(r, g, b);
      }

      // Skip normals if present (3 x f32)
      const hasNormals = metadata.schema.some(d => d.name === 'NormalX');
      if (hasNormals) {
        offset += 12;
      }
    }

    return {
      positions,
      colors: hasColors ? colors : null,
    };
  }

  function getPointSize(metadata) {
    return metadata.schema.reduce((sum, dim) => sum + dim.size, 0);
  }

  return <div ref={containerRef} style={{ width: '100%', height: '600px' }} />;
};

export default EPTPointCloudViewer;
```

## Step 4: Usage in Your React App

```javascript
import EPTPointCloudViewer from './components/EPTPointCloudViewer';

function App() {
  return (
    <div>
      <h1>Point Cloud Viewer</h1>
      <EPTPointCloudViewer pointCloudId="my-model" />
    </div>
  );
}
```

## Directory Structure

```
project/
├── src/
│   ├── client/              # React frontend
│   ├── model_parser/        # Rust CLI tool
│   └── api/                 # Rust API server (new)
│       ├── Cargo.toml
│       └── src/
│           └── main.rs
└── ept-output/              # Generated EPT data
    └── my-model/
        ├── ept.json
        ├── ept-data/
        │   └── 0-0-0-0.bin
        └── ept-hierarchy/
            └── 0-0-0-0.json
```

## Advanced: Streaming Large Point Clouds

For very large point clouds, implement progressive loading:

1. Load root tile first (low detail)
2. As user zooms/pans, load child tiles (higher detail)
3. Unload distant tiles to manage memory
4. Use WebWorkers for parsing to avoid blocking UI

Example hierarchy loading:

```javascript
async function loadTileHierarchy(id, tileKey) {
  const hierarchyResponse = await fetch(
    `/api/pointcloud/${id}/ept-hierarchy/${tileKey}.json`
  );
  const hierarchy = await hierarchyResponse.json();

  // hierarchy contains child tile point counts
  // Load tiles based on camera distance and point density
  for (const [childKey, pointCount] of Object.entries(hierarchy)) {
    if (shouldLoadTile(childKey, pointCount)) {
      await loadTile(id, childKey);
    }
  }
}
```

## Performance Tips

1. **Enable Compression**: Use gzip for JSON/text responses
2. **Binary Format**: EPT binary tiles are already efficient
3. **Caching**: Add cache headers for static EPT files
4. **CDN**: Serve EPT files from CDN for production
5. **Streaming**: Load tiles on-demand based on viewport
6. **LOD**: Use octree hierarchy for level-of-detail rendering

## Next Steps

- Add authentication to API endpoints
- Implement tile caching on server
- Add WebSocket support for real-time updates
- Build admin UI for managing point cloud datasets
- Add support for multiple point cloud formats
