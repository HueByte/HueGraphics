import React, { useState, useEffect, useRef } from "react";
import * as THREE from "three";
import { HiAdjustments } from "react-icons/hi";
import PageNav from "../components/PageNav";
import "./AudioVisualizer.css";

const CONFIG = {
	modes: {
		sphere: { size: 300 },
		spiral: { size: 400 },
		wave: { size: 350 },
		galaxy: { size: 450 },
	},
	colors: {
		purple: { start: 0x8a2be2, mid: 0xa855f7, end: 0xec4899 },
		rainbow: { start: 0x4a0080, mid: 0x8a2be2, end: 0xff0040 },
		fire: { start: 0xff0000, mid: 0xff6600, end: 0xffff00 },
		ocean: { start: 0x06b6d4, mid: 0x0ea5e9, end: 0x3b82f6 },
		intensity: { start: 0x6b46c1, mid: 0xa855f7, end: 0xf4a460 },
	},
};

function AudioVisualizer() {
	const [isPlaying, setIsPlaying] = useState(false);
	const [currentMode, setCurrentMode] = useState("wave");
	const [currentColorScheme, setCurrentColorScheme] = useState("purple");
	const [autoRotateEnabled, setAutoRotateEnabled] = useState(true);
	const [uiVisible, setUiVisible] = useState(true);
	const [currentPointCount, setCurrentPointCount] = useState(16000);
	const [fps, setFps] = useState(60);
	const [bass, setBass] = useState(0);
	const [showDisclaimer, setShowDisclaimer] = useState(true);

	const containerRef = useRef(null);
	const sceneRef = useRef(null);
	const cameraRef = useRef(null);
	const rendererRef = useRef(null);
	const pointsRef = useRef(null);
	const geometryRef = useRef(null);
	const materialRef = useRef(null);

	// Audio refs
	const audioContextRef = useRef(null);
	const analyserRef = useRef(null);
	const dataArrayRef = useRef(null);
	const mediaStreamRef = useRef(null);
	const audioSourceRef = useRef(null);
	const animationIdRef = useRef(null);

	// Animation state
	const animationStateRef = useRef({
		time: 0,
		positions: null,
		colors: null,
		scales: null,
		originalPositions: null,
		randomOffsets: null,
		cameraAngle: 0,
		targetCameraAngle: 0,
		cameraElevation: Math.PI / 6, // Start at 30 degrees elevation (higher angle)
		targetCameraElevation: Math.PI / 6,
		cameraDistance: 500,
		isDragging: false,
		previousMouseX: 0,
		previousMouseY: 0,
		lastTime: performance.now(),
		lastFrameTime: performance.now(),
		frames: 0,
	});

	// Initialize Three.js scene
	useEffect(() => {
		if (!containerRef.current) return;

		const scene = new THREE.Scene();
		// No background color - transparent
		sceneRef.current = scene;

		const camera = new THREE.PerspectiveCamera(
			75,
			containerRef.current.clientWidth / containerRef.current.clientHeight,
			0.1,
			2000
		);
		camera.position.z = 500;
		cameraRef.current = camera;

		const renderer = new THREE.WebGLRenderer({
			antialias: true,
			alpha: true,
			powerPreference: "high-performance",
		});
		renderer.setClearColor(0x000000, 0); // Transparent background
		renderer.setSize(
			containerRef.current.clientWidth,
			containerRef.current.clientHeight
		);
		renderer.setPixelRatio(window.devicePixelRatio);
		containerRef.current.appendChild(renderer.domElement);
		rendererRef.current = renderer;

		const handleResize = () => {
			if (!containerRef.current || !cameraRef.current || !rendererRef.current)
				return;
			cameraRef.current.aspect =
				containerRef.current.clientWidth / containerRef.current.clientHeight;
			cameraRef.current.updateProjectionMatrix();
			rendererRef.current.setSize(
				containerRef.current.clientWidth,
				containerRef.current.clientHeight
			);
		};
		window.addEventListener("resize", handleResize);

		return () => {
			window.removeEventListener("resize", handleResize);

			// Stop audio capture
			stopAudioCapture();

			// Cancel animation frame
			if (animationIdRef.current) {
				cancelAnimationFrame(animationIdRef.current);
				animationIdRef.current = null;
			}

			// Dispose geometries and materials
			if (geometryRef.current) {
				geometryRef.current.dispose();
				geometryRef.current = null;
			}
			if (materialRef.current) {
				materialRef.current.dispose();
				materialRef.current = null;
			}

			// Remove points from scene
			if (pointsRef.current && sceneRef.current) {
				sceneRef.current.remove(pointsRef.current);
				pointsRef.current = null;
			}

			// Dispose scene objects
			if (sceneRef.current) {
				sceneRef.current.traverse((object) => {
					if (object.geometry) {
						object.geometry.dispose();
					}
					if (object.material) {
						if (Array.isArray(object.material)) {
							object.material.forEach((material) => material.dispose());
						} else {
							object.material.dispose();
						}
					}
				});
				sceneRef.current.clear();
				sceneRef.current = null;
			}

			// Dispose renderer
			if (rendererRef.current) {
				rendererRef.current.dispose();

				// Remove canvas from DOM
				if (containerRef.current && rendererRef.current.domElement) {
					try {
						containerRef.current.removeChild(rendererRef.current.domElement);
					} catch (e) {
						// Element might already be removed
					}
				}
				rendererRef.current = null;
			}

			// Clear camera reference
			if (cameraRef.current) {
				cameraRef.current = null;
			}
		};
	}, []);

	// Initialize point cloud
	const initPointCloud = React.useCallback(() => {
		if (!sceneRef.current) return;

		// Remove old point cloud
		if (pointsRef.current) {
			sceneRef.current.remove(pointsRef.current);
			if (geometryRef.current) geometryRef.current.dispose();
			if (materialRef.current) materialRef.current.dispose();
		}

		const config = CONFIG.modes[currentMode];
		const count = currentPointCount;

		const geometry = new THREE.BufferGeometry();
		const positions = new Float32Array(count * 3);
		const colors = new Float32Array(count * 3);
		const scales = new Float32Array(count);
		const randomOffsets = new Float32Array(count * 3);

		// Generate points based on mode
		for (let i = 0; i < count; i++) {
			const i3 = i * 3;
			const t = i / count;

			switch (currentMode) {
				case "sphere": {
					const radius = config.size * Math.random();
					const theta = Math.random() * Math.PI * 2;
					const phi = Math.acos(2 * Math.random() - 1);
					positions[i3] = radius * Math.sin(phi) * Math.cos(theta);
					positions[i3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
					positions[i3 + 2] = radius * Math.cos(phi);
					break;
				}
				case "spiral": {
					const angle = t * Math.PI * 20;
					const radius = t * config.size;
					const height = (t - 0.5) * config.size * 2;
					positions[i3] = Math.cos(angle) * radius;
					positions[i3 + 1] = height;
					positions[i3 + 2] = Math.sin(angle) * radius;
					break;
				}
				case "wave": {
					const gridSize = Math.sqrt(count);
					const x = (i % gridSize) / gridSize;
					const z = Math.floor(i / gridSize) / gridSize;
					positions[i3] = (x - 0.5) * config.size * 2;
					positions[i3 + 1] = 0;
					positions[i3 + 2] = (z - 0.5) * config.size * 2;
					break;
				}
				case "galaxy": {
					const branch = i % 3;
					const angle = (branch / 3) * Math.PI * 2;
					const radius = Math.pow(Math.random(), 2) * config.size;
					const spinAngle = radius * 0.01;
					const x = Math.cos(angle + spinAngle) * radius;
					const z = Math.sin(angle + spinAngle) * radius;
					const y = (Math.random() - 0.5) * 50 * (1 - radius / config.size);
					positions[i3] = x + (Math.random() - 0.5) * 20;
					positions[i3 + 1] = y;
					positions[i3 + 2] = z + (Math.random() - 0.5) * 20;
					break;
				}
			}

			// Set colors
			const colorScheme = CONFIG.colors[currentColorScheme];
			const color1 = new THREE.Color();
			const color2 = new THREE.Color();

			if (t < 0.5) {
				color1.setHex(colorScheme.start);
				color2.setHex(colorScheme.mid);
				color1.lerp(color2, t * 2);
			} else {
				color1.setHex(colorScheme.mid);
				color2.setHex(colorScheme.end);
				color1.lerp(color2, (t - 0.5) * 2);
			}

			colors[i3] = color1.r;
			colors[i3 + 1] = color1.g;
			colors[i3 + 2] = color1.b;

			scales[i] = Math.random() * 2 + 1;
			randomOffsets[i3] = (Math.random() - 0.5) * 20;
			randomOffsets[i3 + 1] = (Math.random() - 0.5) * 50;
			randomOffsets[i3 + 2] = (Math.random() - 0.5) * 20;
		}

		geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
		geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
		geometry.setAttribute("scale", new THREE.BufferAttribute(scales, 1));

		const material = new THREE.PointsMaterial({
			size: 3,
			vertexColors: true,
			transparent: true,
			opacity: 0.8,
			blending: THREE.AdditiveBlending,
			sizeAttenuation: true,
		});

		const points = new THREE.Points(geometry, material);
		sceneRef.current.add(points);

		pointsRef.current = points;
		geometryRef.current = geometry;
		materialRef.current = material;

		animationStateRef.current.positions = positions;
		animationStateRef.current.colors = colors;
		animationStateRef.current.scales = scales;
		animationStateRef.current.originalPositions = new Float32Array(positions);
		animationStateRef.current.randomOffsets = randomOffsets;
	}, [currentMode, currentPointCount, currentColorScheme]);

	// Initialize point cloud on mount and when mode/color changes
	useEffect(() => {
		initPointCloud();
	}, [initPointCloud]);

	// Audio capture
	const startAudioCapture = async () => {
		try {
			stopAudioCapture();

			const stream = await navigator.mediaDevices.getDisplayMedia({
				video: true,
				audio: true,
			});

			const audioTracks = stream.getAudioTracks();
			if (!audioTracks || audioTracks.length === 0) {
				alert('No audio track. Make sure "Share audio" is enabled!');
				stream.getTracks().forEach((track) => track.stop());
				return;
			}

			const audioContext = new (window.AudioContext ||
				window.webkitAudioContext)();
			const audioSource = audioContext.createMediaStreamSource(stream);
			const analyser = audioContext.createAnalyser();

			analyser.fftSize = 512;
			analyser.smoothingTimeConstant = 0.8;

			const bufferLength = analyser.frequencyBinCount;
			const dataArray = new Uint8Array(bufferLength);

			audioSource.connect(analyser);

			stream.getVideoTracks()[0].addEventListener("ended", stopAudioCapture);

			audioContextRef.current = audioContext;
			audioSourceRef.current = audioSource;
			analyserRef.current = analyser;
			dataArrayRef.current = dataArray;
			mediaStreamRef.current = stream;

			setIsPlaying(true);
		} catch (err) {
			console.error(err);
			alert("Error: " + err.message);
			stopAudioCapture();
		}
	};

	const stopAudioCapture = () => {
		setIsPlaying(false);

		if (audioSourceRef.current) {
			try {
				audioSourceRef.current.disconnect();
			} catch (e) {}
			audioSourceRef.current = null;
		}

		if (audioContextRef.current) {
			audioContextRef.current.close().catch(() => {});
			audioContextRef.current = null;
		}

		if (mediaStreamRef.current) {
			mediaStreamRef.current.getTracks().forEach((track) => track.stop());
			mediaStreamRef.current = null;
		}

		dataArrayRef.current = null;
		analyserRef.current = null;
	};

	// Animation loop
	useEffect(() => {
		const targetFPS = 60;
		const frameInterval = 1000 / targetFPS;

		const animate = () => {
			animationIdRef.current = requestAnimationFrame(animate);

			const now = performance.now();
			const elapsed = now - animationStateRef.current.lastFrameTime;

			if (elapsed < frameInterval) return;

			animationStateRef.current.lastFrameTime = now - (elapsed % frameInterval);

			// Calculate FPS
			animationStateRef.current.frames++;
			if (now >= animationStateRef.current.lastTime + 1000) {
				const calculatedFps = Math.round(
					(animationStateRef.current.frames * 1000) /
						(now - animationStateRef.current.lastTime)
				);
				setFps(calculatedFps);
				animationStateRef.current.frames = 0;
				animationStateRef.current.lastTime = now;
			}

			// Gentle baseline rotation when no audio
			if (autoRotateEnabled && !isPlaying) {
				animationStateRef.current.cameraAngle += 0.002;
			}

			// Apply manual rotation adjustments
			if (animationStateRef.current.isDragging) {
				animationStateRef.current.cameraAngle +=
					(animationStateRef.current.targetCameraAngle -
						animationStateRef.current.cameraAngle) *
					0.05;
			} else {
				animationStateRef.current.targetCameraAngle =
					animationStateRef.current.cameraAngle;
			}
			animationStateRef.current.cameraElevation +=
				(animationStateRef.current.targetCameraElevation -
					animationStateRef.current.cameraElevation) *
				0.05;

			// Update camera position
			if (cameraRef.current) {
				const distance = animationStateRef.current.cameraDistance;
				const angle = animationStateRef.current.cameraAngle;
				const elevation = animationStateRef.current.cameraElevation;

				cameraRef.current.position.x =
					Math.sin(angle) * Math.cos(elevation) * distance;
				cameraRef.current.position.y = Math.sin(elevation) * distance;
				cameraRef.current.position.z =
					Math.cos(angle) * Math.cos(elevation) * distance;
				cameraRef.current.lookAt(0, 0, 0);
			}

			// Audio reactivity
			if (
				isPlaying &&
				analyserRef.current &&
				dataArrayRef.current &&
				pointsRef.current
			) {
				analyserRef.current.getByteFrequencyData(dataArrayRef.current);

				const bassValue =
					dataArrayRef.current.slice(0, 20).reduce((a, b) => a + b) / 20;
				setBass(Math.round(bassValue));

				const positions = animationStateRef.current.positions;
				const scales = animationStateRef.current.scales;
				const originalPositions = animationStateRef.current.originalPositions;
				const randomOffsets = animationStateRef.current.randomOffsets;
				const count = positions.length / 3;
				const time = Date.now() * 0.001;

				for (let i = 0; i < count; i++) {
					const i3 = i * 3;
					const normalizedIndex = i / count;
					const logIndex = Math.pow(normalizedIndex, 2.5);
					const freqIndex = Math.floor(
						logIndex * (dataArrayRef.current.length - 1)
					);
					const amplitude = dataArrayRef.current[freqIndex] / 255;

					switch (currentMode) {
						case "sphere":
							if (amplitude > 0.05) {
								const scaleFactor = 1 + amplitude * 0.5;
								const ripple = Math.sin(time * 2 + i * 0.02) * amplitude * 0.2;
								positions[i3] = originalPositions[i3] * (scaleFactor + ripple);
								positions[i3 + 1] =
									originalPositions[i3 + 1] * (scaleFactor + ripple);
								positions[i3 + 2] =
									originalPositions[i3 + 2] * (scaleFactor + ripple);
								scales[i] = 1 + amplitude * 4;
							} else {
								positions[i3] = originalPositions[i3];
								positions[i3 + 1] = originalPositions[i3 + 1];
								positions[i3 + 2] = originalPositions[i3 + 2];
								scales[i] = 1;
							}
							break;

						case "wave":
							if (amplitude > 0.05) {
								const audioWave =
									Math.sin(originalPositions[i3] * 0.015 + time * 2) *
										80 *
										amplitude +
									Math.cos(originalPositions[i3 + 2] * 0.015 + time * 1.5) *
										60 *
										amplitude;
								positions[i3] = originalPositions[i3];
								positions[i3 + 1] = audioWave;
								positions[i3 + 2] = originalPositions[i3 + 2];
								scales[i] = 1 + amplitude * 5;
							} else {
								positions[i3] = originalPositions[i3];
								positions[i3 + 1] = 0;
								positions[i3 + 2] = originalPositions[i3 + 2];
								scales[i] = 1;
							}
							break;

						case "spiral": {
							if (amplitude > 0.05) {
								const spiralAngle = time * 0.5 + (i / count) * Math.PI * 20;
								const spiralRadius = (i / count) * 400 * (1 + amplitude * 0.3);
								const spiralHeight = (i / count - 0.5) * 400;
								positions[i3] = Math.cos(spiralAngle) * spiralRadius;
								positions[i3 + 1] =
									spiralHeight + Math.sin(time + i * 0.01) * 50 * amplitude;
								positions[i3 + 2] = Math.sin(spiralAngle) * spiralRadius;
								scales[i] = 1 + amplitude * 6;
							} else {
								positions[i3] = originalPositions[i3];
								positions[i3 + 1] = originalPositions[i3 + 1];
								positions[i3 + 2] = originalPositions[i3 + 2];
								scales[i] = 1;
							}
							break;
						}

						case "galaxy": {
							if (amplitude > 0.05) {
								const branch = i % 3;
								const branchAngle = (branch / 3) * Math.PI * 2;
								const radius =
									Math.pow((i % (count / 3)) / (count / 3), 0.8) * 450;
								const spinAngle = radius * 0.01 + time * 0.3 + amplitude * 0.5;
								const x = Math.cos(branchAngle + spinAngle) * radius;
								const z = Math.sin(branchAngle + spinAngle) * radius;
								const y =
									randomOffsets[i3 + 1] * (1 - radius / 450) +
									Math.sin(time + i * 0.005) * 30 * amplitude;
								positions[i3] = x + randomOffsets[i3];
								positions[i3 + 1] = y;
								positions[i3 + 2] = z + randomOffsets[i3 + 2];
								scales[i] = 1 + amplitude * 5;
							} else {
								positions[i3] = originalPositions[i3];
								positions[i3 + 1] = originalPositions[i3 + 1];
								positions[i3 + 2] = originalPositions[i3 + 2];
								scales[i] = 1;
							}
							break;
						}
					}
				}

				geometryRef.current.attributes.position.needsUpdate = true;
				geometryRef.current.attributes.scale.needsUpdate = true;

				// Rotate camera on bass hits
				if (autoRotateEnabled && bassValue > 30) {
					const bassNormalized = bassValue / 255;
					const rotationIncrement = Math.pow(bassNormalized, 1.5) * 0.025;
					animationStateRef.current.cameraAngle += rotationIncrement;
				}
			}

			if (rendererRef.current && sceneRef.current && cameraRef.current) {
				rendererRef.current.render(sceneRef.current, cameraRef.current);
			}
		};

		animate();

		return () => {
			if (animationIdRef.current) {
				cancelAnimationFrame(animationIdRef.current);
			}
		};
	}, [isPlaying, autoRotateEnabled, currentMode]);

	// Mouse interaction
	useEffect(() => {
		const canvas = rendererRef.current?.domElement;
		if (!canvas) return;

		const handleMouseDown = (e) => {
			animationStateRef.current.isDragging = true;
			animationStateRef.current.previousMouseX = e.clientX;
			animationStateRef.current.previousMouseY = e.clientY;
		};

		const handleMouseMove = (e) => {
			if (animationStateRef.current.isDragging) {
				const deltaX = e.clientX - animationStateRef.current.previousMouseX;
				const deltaY = e.clientY - animationStateRef.current.previousMouseY;

				animationStateRef.current.targetCameraAngle += deltaX * 0.005;
				animationStateRef.current.targetCameraElevation -= deltaY * 0.005;
				animationStateRef.current.targetCameraElevation = Math.max(
					-Math.PI / 2 + 0.1,
					Math.min(
						Math.PI / 2 - 0.1,
						animationStateRef.current.targetCameraElevation
					)
				);

				animationStateRef.current.previousMouseX = e.clientX;
				animationStateRef.current.previousMouseY = e.clientY;
			}
		};

		const handleMouseUp = () => {
			animationStateRef.current.isDragging = false;
		};

		const handleWheel = (e) => {
			e.preventDefault();
			animationStateRef.current.cameraDistance += e.deltaY * 0.5;
			animationStateRef.current.cameraDistance = Math.max(
				100,
				Math.min(1000, animationStateRef.current.cameraDistance)
			);
		};

		canvas.addEventListener("mousedown", handleMouseDown);
		window.addEventListener("mousemove", handleMouseMove);
		window.addEventListener("mouseup", handleMouseUp);
		canvas.addEventListener("wheel", handleWheel);

		return () => {
			canvas.removeEventListener("mousedown", handleMouseDown);
			window.removeEventListener("mousemove", handleMouseMove);
			window.removeEventListener("mouseup", handleMouseUp);
			canvas.removeEventListener("wheel", handleWheel);
		};
	}, []);

	// Cleanup on unmount
	useEffect(() => {
		return () => {
			stopAudioCapture();
		};
	}, []);

	return (
		<>
			<PageNav
				title="3D Audio Visualizer"
				subtitle="Point Cloud Reactive Sound Experience"
			/>

			<div className="audio-visualizer">
				{/* Privacy Disclaimer Modal */}
				{showDisclaimer && (
					<div className="disclaimer-modal-overlay">
						<div className="disclaimer-modal">
							<div className="disclaimer-header">
								<h2>Privacy Notice</h2>
							</div>
							<div className="disclaimer-content">
								<p>
									This audio visualizer uses{" "}
									<strong>screen capture with audio sharing</strong> to access
									your system's audio output. This is the only way to capture
									audio in the browser.
								</p>
								<p className="disclaimer-highlight">
									<strong>Your privacy matters:</strong>
								</p>
								<ul>
									<li>No video is recorded or stored</li>
									<li>Only audio data is analyzed in real-time</li>
									<li>All processing happens locally in your browser</li>
									<li>No data is sent to any server</li>
									<li>
										Audio stream is discarded immediately after visualization
									</li>
								</ul>
								<p>
									This tool is completely open source. You can verify the code
									yourself:
								</p>
								<a
									href="https://github.com/HueByte/HueGraphics/tree/master/src/client/src/pages/AudioVisualizer.jsx"
									target="_blank"
									rel="noopener noreferrer"
									className="disclaimer-link"
								>
									View Source Code on GitHub →
								</a>
							</div>
							<div className="disclaimer-footer">
								<button
									className="btn-primary disclaimer-btn"
									onClick={() => setShowDisclaimer(false)}
								>
									I Understand
								</button>
							</div>
						</div>
					</div>
				)}

				<button
					className="toggle-ui-btn"
					onClick={() => setUiVisible(!uiVisible)}
					aria-label="Toggle UI"
				>
					<HiAdjustments />
				</button>

				<div className="audio-content">
					<div className={`ui-overlay ${!uiVisible ? "hidden" : ""}`}>
						<div className="controls-panel">
							<div className="control-section">
								<button
									id="startBtn"
									className={`btn-primary ${isPlaying ? "pulsing" : ""}`}
									onClick={isPlaying ? stopAudioCapture : startAudioCapture}
								>
									{isPlaying ? "Stop Audio Capture" : "Start Audio Capture"}
								</button>
							</div>

							<div className="section-separator"></div>

							<div className="control-section">
								<label className="section-label">Visualization Mode</label>
								<div className="button-group-vertical">
									{Object.keys(CONFIG.modes).map((mode) => (
										<button
											key={mode}
											className={`btn-secondary mode-btn ${
												currentMode === mode ? "active" : ""
											}`}
											onClick={() => setCurrentMode(mode)}
										>
											{mode.charAt(0).toUpperCase() + mode.slice(1)}
										</button>
									))}
								</div>
							</div>

							<div className="section-separator"></div>

							<div className="control-section">
								<label className="section-label">Color Scheme</label>
								<div className="button-group-vertical">
									{Object.keys(CONFIG.colors).map((color) => (
										<button
											key={color}
											className={`btn-secondary color-btn ${
												currentColorScheme === color ? "active" : ""
											}`}
											onClick={() => setCurrentColorScheme(color)}
										>
											{color.charAt(0).toUpperCase() + color.slice(1)}
										</button>
									))}
								</div>
							</div>

							<div className="section-separator"></div>

							<div className="control-section">
								<label className="section-label">Auto Rotation</label>
								<button
									className={`btn-secondary ${
										autoRotateEnabled ? "active" : ""
									}`}
									onClick={() => setAutoRotateEnabled(!autoRotateEnabled)}
								>
									{autoRotateEnabled ? "Enabled" : "Disabled"}
								</button>
							</div>

							<div className="section-separator"></div>

							<div className="control-section">
								<div className="slider-container">
									<div className="slider-header">
										<label
											className="section-label"
											style={{ marginBottom: 0 }}
										>
											Point Count
										</label>
										<span className="slider-value">
											{(currentPointCount / 1000).toFixed(0)}K
										</span>
									</div>
									<input
										type="range"
										min="4000"
										max="32000"
										value={currentPointCount}
										step="2000"
										onChange={(e) =>
											setCurrentPointCount(parseInt(e.target.value))
										}
									/>
								</div>
							</div>
						</div>

						<div className="stats">
							<div className="stat">
								<div className="stat-value">{fps}</div>
								<div className="stat-label">FPS</div>
							</div>
							<div className="stat">
								<div className="stat-value">
									{(currentPointCount / 1000).toFixed(0)}K
								</div>
								<div className="stat-label">Points</div>
							</div>
							<div className="stat">
								<div className={`stat-value ${isPlaying ? "pulsing" : ""}`}>
									{bass}
								</div>
								<div className="stat-label">Bass</div>
							</div>
						</div>

						<div className="info-message">
							When prompted, select a tab/window playing audio and enable "Share
							audio". Drag to rotate, scroll to zoom. Best experienced with
							music!
						</div>
					</div>

					<div className="viewer-container" ref={containerRef} />
				</div>
			</div>
		</>
	);
}

export default AudioVisualizer;
