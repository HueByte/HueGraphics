import React, { useState, useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass";
import PageNav from "../components/PageNav";
import {
	generateMandelbulb,
	generateMandelbox,
	generateJuliaSet3D,
	generateSierpinskiTetrahedron,
	generateApollonianGasket,
	generateFractalFlame
} from "../fractals";
import "./FractalViewer.css";

function FractalViewer() {
	const [useColors, setUseColors] = useState(true); // Default to colors for beauty
	const [selectedFractal, setSelectedFractal] = useState("mandelbulb");
	const [pointCount, setPointCount] = useState(0);
	const [zoomDepth, setZoomDepth] = useState(0);
	const [maxParticles, setMaxParticles] = useState(100000); // Default 100k particles
	const [autoRotate, setAutoRotate] = useState(true); // Auto-rotate enabled by default
	const [useMorphing, setUseMorphing] = useState(false); // Morphing disabled by default

	const containerRef = useRef(null);
	const sceneRef = useRef(null);
	const cameraRef = useRef(null);
	const rendererRef = useRef(null);
	const controlsRef = useRef(null);
	const pointCloudsRef = useRef([]); // Multiple point clouds for trails
	const composerRef = useRef(null);
	const animationFrameRef = useRef(null);

	// Animation state
	const animationStateRef = useRef({
		time: 0,
		cameraDistance: 8,
		targetCameraDistance: 8,
		zoomPhase: 0, // 0 = zoom in, 1 = zoom out
		particleTrails: [],
		maxTrails: 3, // Number of trail copies
		currentIteration: 0,
		// Morphing state
		previousPoints: [],
		previousColors: [],
		targetPoints: [],
		targetColors: [],
		morphProgress: 0,
		morphDuration: 2000, // 2 seconds morph transition
		shapeHoldDuration: 4000, // 4 seconds to hold each shape before morphing
		lastMorphTime: 0
	});

	const fractals = {
		mandelbulb: { name: "Mandelbulb (Infinite Zoom)", generator: generateMandelbulb },
		mandelbox: { name: "Mandelbox", generator: generateMandelbox },
		julia: { name: "Julia Set 3D", generator: generateJuliaSet3D },
		apollonian: { name: "Apollonian Gasket", generator: generateApollonianGasket },
		sierpinski: { name: "Sierpinski Tetrahedron", generator: generateSierpinskiTetrahedron },
		flame: { name: "Fractal Flame", generator: generateFractalFlame },
	};

	// Initialize Three.js with bloom effects
	useEffect(() => {
		if (!containerRef.current) return;

		const scene = new THREE.Scene();
		scene.background = new THREE.Color(0x0a0a0f); // Dark background instead of transparent
		sceneRef.current = scene;

		const camera = new THREE.PerspectiveCamera(
			60,
			containerRef.current.clientWidth / containerRef.current.clientHeight,
			0.1,
			1000
		);
		camera.position.set(8, 8, 8);
		cameraRef.current = camera;

		const renderer = new THREE.WebGLRenderer({
			antialias: false, // Disable for better performance
			alpha: false, // Disable alpha
			powerPreference: "high-performance"
		});
		renderer.setSize(
			containerRef.current.clientWidth,
			containerRef.current.clientHeight
		);
		renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
		containerRef.current.appendChild(renderer.domElement);
		rendererRef.current = renderer;

		// Post-processing for bloom effect
		const composer = new EffectComposer(renderer);
		const renderPass = new RenderPass(scene, camera);
		composer.addPass(renderPass);

		const bloomPass = new UnrealBloomPass(
			new THREE.Vector2(window.innerWidth, window.innerHeight),
			0.2, // strength - reduced to prevent over-bloom in dense areas
			0.15, // radius - smaller radius for tighter bloom
			0.7 // threshold - higher threshold means only brighter pixels bloom
		);
		composer.addPass(bloomPass);
		composerRef.current = composer;

		const controls = new OrbitControls(camera, renderer.domElement);
		controls.enableDamping = true;
		controls.dampingFactor = 0.05;
		controls.autoRotate = autoRotate;
		controls.autoRotateSpeed = 0.5;
		controlsRef.current = controls;

		const handleResize = () => {
			if (!containerRef.current) return;
			camera.aspect = containerRef.current.clientWidth / containerRef.current.clientHeight;
			camera.updateProjectionMatrix();
			renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
			composer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
		};
		window.addEventListener("resize", handleResize);

		return () => {
			window.removeEventListener("resize", handleResize);
			controls.dispose();

			// Dispose all point clouds
			pointCloudsRef.current.forEach(cloud => {
				if (cloud.geometry) cloud.geometry.dispose();
				if (cloud.material) cloud.material.dispose();
			});
			pointCloudsRef.current = [];

			// Dispose composer and its passes
			if (composerRef.current) {
				composerRef.current.passes.forEach(pass => {
					if (pass.dispose) pass.dispose();
				});
			}

			// Dispose scene objects
			if (sceneRef.current) {
				sceneRef.current.traverse((object) => {
					if (object.geometry) object.geometry.dispose();
					if (object.material) {
						if (Array.isArray(object.material)) {
							object.material.forEach(material => material.dispose());
						} else {
							object.material.dispose();
						}
					}
				});
			}

			renderer.dispose();
			if (containerRef.current && renderer.domElement) {
				containerRef.current.removeChild(renderer.domElement);
			}
		};
	}, [autoRotate]);

	// Update controls when autoRotate changes
	useEffect(() => {
		if (controlsRef.current) {
			controlsRef.current.autoRotate = autoRotate;
		}
	}, [autoRotate]);

	// Animation loop with trails
	useEffect(() => {
		if (!sceneRef.current || !cameraRef.current || !rendererRef.current) return;

		let lastUpdate = 0;
		const updateInterval = useMorphing ? 50 : 200; // Update more frequently when morphing

		const animate = (timestamp) => {
			animationFrameRef.current = requestAnimationFrame(animate);

			animationStateRef.current.time += 0.016;
			const time = animationStateRef.current.time;

			// Update fractal at intervals
			if (timestamp - lastUpdate > updateInterval) {
				const fractal = fractals[selectedFractal];
				if (fractal) {
					const generated = fractal.generator(time);

					if (useMorphing) {
						// Morphing enabled - smooth transition
						const state = animationStateRef.current;

						// Check if we need to start a new morph
						if (state.morphProgress >= 1 || state.previousPoints.length === 0) {
							// Start new morph cycle
							state.previousPoints = state.targetPoints.length > 0 ? [...state.targetPoints] : generated.points;
							state.previousColors = state.targetColors.length > 0 ? [...state.targetColors] : generated.colors;
							state.targetPoints = generated.points;
							state.targetColors = generated.colors;
							state.morphProgress = 0;
							state.lastMorphTime = timestamp;
						}

						// Calculate morph progress with easing
						const elapsed = timestamp - state.lastMorphTime;
						const rawProgress = Math.min(elapsed / state.morphDuration, 1);
						// Quadratic ease-in-out
						const t = rawProgress < 0.5
							? 2 * rawProgress * rawProgress
							: 1 - Math.pow(-2 * rawProgress + 2, 2) / 2;
						state.morphProgress = t;

						// Interpolate points and colors
						const morphedPoints = interpolatePoints(state.previousPoints, state.targetPoints, t);
						const morphedColors = interpolateColors(state.previousColors, state.targetColors, t);

						updatePointCloudWithTrails(morphedPoints, morphedColors);
					} else {
						// Instant update (default behavior)
						updatePointCloudWithTrails(generated.points, generated.colors);
					}

					// Update zoom depth display
					const zoomCycle = time * 0.08;
					const depth = Math.floor(Math.abs(Math.sin(zoomCycle)) * 100);
					setZoomDepth(depth);
				}
				lastUpdate = timestamp;
			}

			// Animate camera for zoom effect
			const targetDist = 6 + Math.sin(time * 0.05) * 2;
			animationStateRef.current.cameraDistance += (targetDist - animationStateRef.current.cameraDistance) * 0.02;

			if (controlsRef.current) {
				controlsRef.current.update();
			}

			if (composerRef.current) {
				composerRef.current.render();
			}
		};

		animate(0);

		return () => {
			if (animationFrameRef.current) {
				cancelAnimationFrame(animationFrameRef.current);
			}
		};
	}, [selectedFractal, useColors, useMorphing]);

	// Helper function to interpolate between point sets
	const interpolatePoints = (prevPoints, nextPoints, t) => {
		if (prevPoints.length === 0) return nextPoints;

		const maxLen = Math.max(prevPoints.length, nextPoints.length);
		const result = [];

		for (let i = 0; i < maxLen; i++) {
			const prev = prevPoints[i % prevPoints.length];
			const next = nextPoints[i % nextPoints.length];

			result.push(new THREE.Vector3(
				prev.x + (next.x - prev.x) * t,
				prev.y + (next.y - prev.y) * t,
				prev.z + (next.z - prev.z) * t
			));
		}

		return result;
	};

	// Helper function to interpolate between color sets
	const interpolateColors = (prevColors, nextColors, t) => {
		if (prevColors.length === 0) return nextColors;

		const maxLen = Math.max(prevColors.length, nextColors.length);
		const result = [];

		for (let i = 0; i < maxLen; i++) {
			const prev = prevColors[i % prevColors.length];
			const next = nextColors[i % nextColors.length];

			result.push(new THREE.Color(
				prev.r + (next.r - prev.r) * t,
				prev.g + (next.g - prev.g) * t,
				prev.b + (next.b - prev.b) * t
			));
		}

		return result;
	};

	// Update point cloud with trail effect
	const updatePointCloudWithTrails = (points, colors) => {
		if (!sceneRef.current || points.length === 0) return;

		// Limit points based on maxParticles slider
		if (points.length > maxParticles) {
			const step = Math.ceil(points.length / maxParticles);
			const limitedPoints = [];
			const limitedColors = [];
			for (let i = 0; i < points.length; i += step) {
				limitedPoints.push(points[i]);
				limitedColors.push(colors[i]);
			}
			points = limitedPoints;
			colors = limitedColors;
		}

		// Create new point cloud
		const geometry = new THREE.BufferGeometry();
		const positions = new Float32Array(points.length * 3);
		const colorArray = new Float32Array(points.length * 3);

		points.forEach((point, i) => {
			positions[i * 3] = point.x;
			positions[i * 3 + 1] = point.y;
			positions[i * 3 + 2] = point.z;

			if (useColors) {
				colorArray[i * 3] = colors[i].r;
				colorArray[i * 3 + 1] = colors[i].g;
				colorArray[i * 3 + 2] = colors[i].b;
			} else {
				const depth = Math.abs(point.z) / 5;
				const brightness = 0.1 + depth * 0.3;
				colorArray[i * 3] = brightness;
				colorArray[i * 3 + 1] = brightness;
				colorArray[i * 3 + 2] = brightness;
			}
		});

		geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
		geometry.setAttribute("color", new THREE.BufferAttribute(colorArray, 3));

		const material = new THREE.PointsMaterial({
			size: 0.08, // Increased from 0.04
			vertexColors: true,
			sizeAttenuation: true,
			transparent: true,
			opacity: 0.8, // Slightly transparent
			blending: THREE.AdditiveBlending, // Glowing effect
		});

		const pointCloud = new THREE.Points(geometry, material);

		// Add to scene
		sceneRef.current.add(pointCloud);
		pointCloudsRef.current.push(pointCloud);

		// Keep only last few for trail effect
		while (pointCloudsRef.current.length > animationStateRef.current.maxTrails) {
			const old = pointCloudsRef.current.shift();
			sceneRef.current.remove(old);
			old.geometry.dispose();
			old.material.dispose();
		}

		// Fade older trails
		pointCloudsRef.current.forEach((cloud, i) => {
			const age = pointCloudsRef.current.length - i;
			cloud.material.opacity = 1.0 / age;
		});

		setPointCount(points.length);
	};

	return (
		<div className="fractal-viewer">
			<PageNav
				title="Fractal Viewer"
				subtitle="Infinite animated 3D fractals with bloom and particle trails"
			/>

			<div className="fractal-content">
				<div className="control-panel">
					<div className="status-section">
						<h3>Fractal Selection</h3>
						<select
							value={selectedFractal}
							onChange={(e) => {
								setSelectedFractal(e.target.value);
								animationStateRef.current.time = 0;
								// Clear trails
								pointCloudsRef.current.forEach(cloud => {
									sceneRef.current.remove(cloud);
									cloud.geometry.dispose();
									cloud.material.dispose();
								});
								pointCloudsRef.current = [];
							}}
							className="fractal-select"
						>
							{Object.entries(fractals).map(([key, fractal]) => (
								<option key={key} value={key}>{fractal.name}</option>
							))}
						</select>

						<div className="status-grid">
							<div className="status-item">
								<span className="status-label">Current:</span>
								<span className="status-value fractal-name">
									{fractals[selectedFractal].name}
								</span>
							</div>
							<div className="status-item">
								<span className="status-label">Points:</span>
								<span className="status-value">
									{pointCount.toLocaleString()}
								</span>
							</div>
							<div className="status-item">
								<span className="status-label">Zoom Depth:</span>
								<span className="status-value zoom-depth">
									{zoomDepth}%
								</span>
							</div>
						</div>
					</div>

					<div className="controls-section">
						<h3>Effects</h3>
						<div className="toggle-group">
							<label className="toggle-label">
								<input
									type="checkbox"
									checked={useColors}
									onChange={(e) => setUseColors(e.target.checked)}
									className="toggle-checkbox"
								/>
								<span className="toggle-slider"></span>
								<span className="toggle-text">
									{useColors ? "Rainbow Colors" : "Monochrome"}
								</span>
							</label>

							<label className="toggle-label">
								<input
									type="checkbox"
									checked={autoRotate}
									onChange={(e) => setAutoRotate(e.target.checked)}
									className="toggle-checkbox"
								/>
								<span className="toggle-slider"></span>
								<span className="toggle-text">
									{autoRotate ? "Auto-Rotate: On" : "Auto-Rotate: Off"}
								</span>
							</label>

							<label className="toggle-label">
								<input
									type="checkbox"
									checked={useMorphing}
									onChange={(e) => {
										setUseMorphing(e.target.checked);
										// Reset morphing state when toggling
										animationStateRef.current.previousPoints = [];
										animationStateRef.current.targetPoints = [];
									}}
									className="toggle-checkbox"
								/>
								<span className="toggle-slider"></span>
								<span className="toggle-text">
									{useMorphing ? "Smooth Morphing: On" : "Smooth Morphing: Off"}
								</span>
							</label>
						</div>

						<div className="slider-group">
							<label className="slider-label">
								<span className="slider-text">Max Particles</span>
								<span className="slider-value">{(maxParticles / 1000).toFixed(0)}K</span>
							</label>
							<input
								type="range"
								min="10000"
								max="200000"
								step="10000"
								value={maxParticles}
								onChange={(e) => setMaxParticles(parseInt(e.target.value))}
								className="particle-slider"
							/>
							<div className="slider-markers">
								<span>10K</span>
								<span>100K</span>
								<span>200K</span>
							</div>
						</div>

						<p className="info-text effects-list">
							✨ Bloom effect enabled
							<br />
							🌀 Particle trails active
							<br />
							♾️ Infinite zoom animation
						</p>
					</div>

					<div className="info-section">
						<h3>Controls</h3>
						<p className="info-text">
							<strong>Left Click + Drag:</strong> Rotate view
							<br />
							<strong>Right Click + Drag:</strong> Pan camera
							<br />
							<strong>Scroll:</strong> Zoom in/out
						</p>
						<p className="info-text">
							Watch as fractals continuously zoom into infinite detail,
							revealing never-ending patterns and structures.
						</p>
					</div>
				</div>

				<div className="viewer-container" ref={containerRef} />
			</div>
		</div>
	);
}

export default FractalViewer;
