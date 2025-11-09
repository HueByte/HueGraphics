import React, { useRef, useEffect, useState } from "react";
import * as THREE from "three";
import CameraControls from "camera-controls";
import { pointCloudApi } from "../services/api";
import "./PointCloudBackground.css";

// Install camera controls
CameraControls.install({ THREE: THREE });

const PointCloudBackground = ({ pointCloudId }) => {
	const containerRef = useRef(null);
	const sceneRef = useRef(null);
	const rendererRef = useRef(null);
	const cameraRef = useRef(null);
	const cameraControlsRef = useRef(null);
	const pointsRef = useRef(null);
	const animationFrameRef = useRef(null);
	const clockRef = useRef(new THREE.Clock());
	const [pointCloudData, setPointCloudData] = useState(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);
	const [detailLevel, setDetailLevel] = useState(0.5);
	const [animationEnabled, setAnimationEnabled] = useState(true);
	const [depthColoringEnabled, setDepthColoringEnabled] = useState(false);
	const [cameraDistanceColoring, setCameraDistanceColoring] = useState(false);

	// Fetch point cloud data when pointCloudId changes
	useEffect(() => {
		if (!pointCloudId) return;

		const fetchData = async () => {
			try {
				setLoading(true);
				setError(null);
				const metadata = await pointCloudApi.getPointCloudMetadata(pointCloudId);

				// For EPT format, fetch metadata and root tile
				if (metadata.format === 'ept') {
					const eptMetadata = await pointCloudApi.getEptMetadata(pointCloudId);

					// Fetch root tile (0-0-0-0.bin)
					const rootTile = await pointCloudApi.getEptTile(pointCloudId, '0-0-0-0');

					setPointCloudData({ metadata, eptMetadata, rootTile, format: 'ept' });
				} else {
					// For JSON format
					const data = await pointCloudApi.getPointCloudData(pointCloudId);
					setPointCloudData({ metadata, data, format: 'json' });
				}
			} catch (err) {
				console.error('Failed to load point cloud:', err);
				setError(err.message);
			} finally {
				setLoading(false);
			}
		};

		fetchData();
	}, [pointCloudId]);

	useEffect(() => {
		if (!containerRef.current || !pointCloudData) return;

		// Store container ref for cleanup
		const container = containerRef.current;

		// Scene setup
		const scene = new THREE.Scene();
		sceneRef.current = scene;

		// Camera setup
		const camera = new THREE.PerspectiveCamera(
			60,
			containerRef.current.clientWidth / containerRef.current.clientHeight,
			0.1,
			1000
		);
		camera.position.set(0, 2, 5);
		cameraRef.current = camera;

		// Renderer setup
		const renderer = new THREE.WebGLRenderer({
			alpha: true,
			antialias: true,
			powerPreference: "high-performance",
		});
		renderer.setSize(
			containerRef.current.clientWidth,
			containerRef.current.clientHeight
		);
		renderer.setPixelRatio(window.devicePixelRatio);
		container.appendChild(renderer.domElement);
		rendererRef.current = renderer;

		// Camera controls setup
		const cameraControls = new CameraControls(camera, renderer.domElement);
		cameraControlsRef.current = cameraControls;

		// Load point cloud data
		let allPositions, positions, colors;
		let totalPointCount = 0;

		if (pointCloudData.format === 'json' && pointCloudData.data) {
			// Parse JSON point cloud
			totalPointCount = pointCloudData.data.points.length;
			allPositions = new Float32Array(totalPointCount * 3);

			for (let i = 0; i < totalPointCount; i++) {
				const point = pointCloudData.data.points[i];
				allPositions[i * 3] = point.position[0];
				allPositions[i * 3 + 1] = point.position[1];
				allPositions[i * 3 + 2] = point.position[2];
			}
		} else if (pointCloudData.format === 'ept' && pointCloudData.rootTile) {
			// Parse EPT binary tile
			// EPT format: X(f32), Y(f32), Z(f32), R(u8), G(u8), B(u8), NX(f32), NY(f32), NZ(f32)
			const buffer = pointCloudData.rootTile;
			const pointSize = 4 + 4 + 4 + 1 + 1 + 1 + 4 + 4 + 4; // 27 bytes per point
			totalPointCount = Math.floor(buffer.byteLength / pointSize);
			allPositions = new Float32Array(totalPointCount * 3);

			const dataView = new DataView(buffer);
			let offset = 0;

			for (let i = 0; i < totalPointCount; i++) {
				// Read position (3 floats)
				allPositions[i * 3] = dataView.getFloat32(offset, true);
				allPositions[i * 3 + 1] = dataView.getFloat32(offset + 4, true);
				allPositions[i * 3 + 2] = dataView.getFloat32(offset + 8, true);

				// Skip colors and normals
				offset += pointSize;
			}
		} else {
			// Fallback
			allPositions = new Float32Array(0);
			totalPointCount = 0;
		}

		// Apply detail level (subsample points)
		const pointCount = Math.floor(totalPointCount * detailLevel);
		const step = totalPointCount / pointCount;

		positions = new Float32Array(pointCount * 3);
		colors = new Float32Array(pointCount * 3);

		for (let i = 0; i < pointCount; i++) {
			const sourceIndex = Math.floor(i * step);
			positions[i * 3] = allPositions[sourceIndex * 3];
			positions[i * 3 + 1] = allPositions[sourceIndex * 3 + 1];
			positions[i * 3 + 2] = allPositions[sourceIndex * 3 + 2];

			// Default black color
			colors[i * 3] = 0.0;
			colors[i * 3 + 1] = 0.0;
			colors[i * 3 + 2] = 0.0;
		}

		// Store original positions for depth calculations
		const originalPositionsForDepth = new Float32Array(positions);

		// Create geometry with loaded point cloud data
		const geometry = new THREE.BufferGeometry();
		geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
		geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

		// Center the point cloud
		geometry.computeBoundingBox();
		const center = new THREE.Vector3();
		geometry.boundingBox.getCenter(center);
		geometry.translate(-center.x, -center.y, -center.z);

		// Scale to fit in view
		const size = new THREE.Vector3();
		geometry.boundingBox.getSize(size);
		const maxDim = Math.max(size.x, size.y, size.z);
		const scale = 4 / maxDim;
		geometry.scale(scale, scale, scale);

		// Create material - black squares like original
		const material = new THREE.PointsMaterial({
			size: 0.05,
			vertexColors: true,
			transparent: false,
			opacity: 1.0,
			sizeAttenuation: true,
			blending: THREE.NormalBlending,
		});

		// Create points
		const points = new THREE.Points(geometry, material);
		scene.add(points);
		pointsRef.current = points;

		// Set camera controls target to center of point cloud
		cameraControls.setTarget(0, 0, 0);

		// Animation loop
		const clock = clockRef.current;
		let time = 0;
		const originalPositions = new Float32Array(positions);

		// Create chaotic initial positions
		const chaoticPositions = new Float32Array(positions.length);
		let seed = 12345;
		const seededRandom = () => {
			seed = (seed * 9301 + 49297) % 233280;
			return seed / 233280;
		};

		for (let i = 0; i < chaoticPositions.length / 3; i++) {
			const i3 = i * 3;
			// Random positions in a sphere around the model
			const theta = seededRandom() * Math.PI * 2;
			const phi = seededRandom() * Math.PI;
			const radius = 3 + seededRandom() * 2;

			chaoticPositions[i3] = radius * Math.sin(phi) * Math.cos(theta);
			chaoticPositions[i3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
			chaoticPositions[i3 + 2] = radius * Math.cos(phi);
		}

		// Set initial chaotic positions
		const posAttr = geometry.attributes.position;
		for (let i = 0; i < posAttr.count; i++) {
			const i3 = i * 3;
			posAttr.array[i3] = chaoticPositions[i3];
			posAttr.array[i3 + 1] = chaoticPositions[i3 + 1];
			posAttr.array[i3 + 2] = chaoticPositions[i3 + 2];
		}
		posAttr.needsUpdate = true;

		// Morph animation parameters
		const MORPH_DURATION = 2.0; // 2 seconds to morph into shape
		let morphProgress = 0;

		const animate = () => {
			animationFrameRef.current = requestAnimationFrame(animate);

			const delta = clock.getDelta();
			time += delta;

			const updated = cameraControls.update(delta);

			const posAttr = geometry.attributes.position;

			// Morph from chaotic to actual shape
			if (morphProgress < 1.0) {
				morphProgress = Math.min(morphProgress + delta / MORPH_DURATION, 1.0);

				// Smooth easing function
				const t = (Math.sin((morphProgress - 0.5) * Math.PI) + 1) / 2;

				for (let i = 0; i < posAttr.count; i++) {
					const i3 = i * 3;

					// Interpolate from chaotic to original positions
					posAttr.array[i3] = chaoticPositions[i3] * (1 - t) + originalPositions[i3] * t;
					posAttr.array[i3 + 1] = chaoticPositions[i3 + 1] * (1 - t) + originalPositions[i3 + 1] * t;
					posAttr.array[i3 + 2] = chaoticPositions[i3 + 2] * (1 - t) + originalPositions[i3 + 2] * t;
				}
				posAttr.needsUpdate = true;
			}
			// Apply floating animation after morph is complete
			else if (animationEnabled) {
				for (let i = 0; i < posAttr.count; i++) {
					const i3 = i * 3;
					// Add subtle sine wave floating effect
					const floatOffset = Math.sin(time * 2 + i * 0.01) * 0.01;
					posAttr.array[i3] = originalPositions[i3];
					posAttr.array[i3 + 1] = originalPositions[i3 + 1] + floatOffset;
					posAttr.array[i3 + 2] = originalPositions[i3 + 2];
				}
				posAttr.needsUpdate = true;
			}

			// Update colors based on visualization mode
			if (morphProgress >= 1.0) {
				const colorAttr = geometry.attributes.color;

				if (depthColoringEnabled) {
					// Depth-based coloring (Z-axis gradient)
					let minZ = Infinity, maxZ = -Infinity;
					for (let i = 0; i < posAttr.count; i++) {
						const z = originalPositionsForDepth[i * 3 + 2];
						if (z < minZ) minZ = z;
						if (z > maxZ) maxZ = z;
					}
					const zRange = maxZ - minZ;

					for (let i = 0; i < posAttr.count; i++) {
						const i3 = i * 3;
						const z = originalPositionsForDepth[i3 + 2];
						const t = zRange > 0 ? (z - minZ) / zRange : 0.5;

						// Purple to pink gradient based on depth
						colorAttr.array[i3] = 0.54 + t * 0.46; // R: 138/255 -> 255/255
						colorAttr.array[i3 + 1] = 0.17 - t * 0.17; // G: 43/255 -> 0/255
						colorAttr.array[i3 + 2] = 0.89 + t * 0.11; // B: 226/255 -> 255/255
					}
					colorAttr.needsUpdate = true;
				}
				else if (cameraDistanceColoring) {
					// Distance from camera coloring
					const camPos = camera.position;
					let minDist = Infinity, maxDist = -Infinity;

					// Calculate distance range
					for (let i = 0; i < posAttr.count; i++) {
						const i3 = i * 3;
						const dx = posAttr.array[i3] - camPos.x;
						const dy = posAttr.array[i3 + 1] - camPos.y;
						const dz = posAttr.array[i3 + 2] - camPos.z;
						const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
						if (dist < minDist) minDist = dist;
						if (dist > maxDist) maxDist = dist;
					}
					const distRange = maxDist - minDist;

					// Apply gradient based on camera distance
					for (let i = 0; i < posAttr.count; i++) {
						const i3 = i * 3;
						const dx = posAttr.array[i3] - camPos.x;
						const dy = posAttr.array[i3 + 1] - camPos.y;
						const dz = posAttr.array[i3 + 2] - camPos.z;
						const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
						const t = distRange > 0 ? (dist - minDist) / distRange : 0.5;

						// Blue to red gradient (close = blue, far = red)
						colorAttr.array[i3] = t; // R
						colorAttr.array[i3 + 1] = 0.3 * (1 - Math.abs(t - 0.5) * 2); // G (peak at middle)
						colorAttr.array[i3 + 2] = 1 - t; // B
					}
					colorAttr.needsUpdate = true;
				}
				else {
					// Reset to black
					for (let i = 0; i < colorAttr.count; i++) {
						const i3 = i * 3;
						colorAttr.array[i3] = 0.0;
						colorAttr.array[i3 + 1] = 0.0;
						colorAttr.array[i3 + 2] = 0.0;
					}
					colorAttr.needsUpdate = true;
				}
			}

			renderer.render(scene, camera);
		};

		animate();

		// Handle window resize
		const handleResize = () => {
			if (!containerRef.current) return;

			camera.aspect =
				containerRef.current.clientWidth / containerRef.current.clientHeight;
			camera.updateProjectionMatrix();
			renderer.setSize(
				containerRef.current.clientWidth,
				containerRef.current.clientHeight
			);
		};

		window.addEventListener("resize", handleResize);

		// Cleanup
		return () => {
			window.removeEventListener("resize", handleResize);
			if (animationFrameRef.current) {
				cancelAnimationFrame(animationFrameRef.current);
			}
			if (cameraControls) {
				cameraControls.dispose();
			}
			if (container && renderer.domElement) {
				container.removeChild(renderer.domElement);
			}
			geometry.dispose();
			material.dispose();
			renderer.dispose();
		};
	}, [pointCloudData, detailLevel, animationEnabled, depthColoringEnabled, cameraDistanceColoring]);

	if (loading) {
		return (
			<div className="point-cloud-container">
				<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--fg)' }}>
					Loading point cloud...
				</div>
			</div>
		);
	}

	if (error) {
		return (
			<div className="point-cloud-container">
				<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--accent-pink)' }}>
					Error: {error}
				</div>
			</div>
		);
	}

	return (
		<>
			<div ref={containerRef} className="point-cloud-container" />
			<div className="point-cloud-controls">
				<div className="control-group">
					<label>
						Detail Level: {Math.round(detailLevel * 100)}%
						<input
							type="range"
							min="0.1"
							max="1.0"
							step="0.05"
							value={detailLevel}
							onChange={(e) => setDetailLevel(parseFloat(e.target.value))}
						/>
					</label>
				</div>
				<div className="control-group">
					<label>
						<input
							type="checkbox"
							checked={animationEnabled}
							onChange={(e) => setAnimationEnabled(e.target.checked)}
						/>
						Floating Animation
					</label>
				</div>
				<div className="control-group">
					<label>
						<input
							type="checkbox"
							checked={depthColoringEnabled}
							onChange={(e) => {
								setDepthColoringEnabled(e.target.checked);
								if (e.target.checked) setCameraDistanceColoring(false);
							}}
						/>
						Depth Gradient (Z-axis)
					</label>
				</div>
				<div className="control-group">
					<label>
						<input
							type="checkbox"
							checked={cameraDistanceColoring}
							onChange={(e) => {
								setCameraDistanceColoring(e.target.checked);
								if (e.target.checked) setDepthColoringEnabled(false);
							}}
						/>
						Camera Distance Gradient
					</label>
				</div>
			</div>
		</>
	);
};

export default PointCloudBackground;
