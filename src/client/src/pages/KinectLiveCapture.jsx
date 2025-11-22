import React, { useState, useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import * as signalR from "@microsoft/signalr";
import PageNav from "../components/PageNav";
import { kinectApi } from "../services/api";
import "./KinectLiveCapture.css";

function KinectLiveCapture() {
	const [status, setStatus] = useState({
		isConnected: false,
		isStreaming: false,
		fps: 0,
		totalFrames: 0,
		statusMessage: "Not initialized",
		errorMessage: null,
	});
	const [isInitializing, setIsInitializing] = useState(false);
	const [isConnecting, setIsConnecting] = useState(false);
	const [pointCount, setPointCount] = useState(0);
	const [connectionStatus, setConnectionStatus] = useState("Disconnected");

	const containerRef = useRef(null);
	const sceneRef = useRef(null);
	const cameraRef = useRef(null);
	const rendererRef = useRef(null);
	const controlsRef = useRef(null);
	const pointCloudRef = useRef(null);
	const hubConnectionRef = useRef(null);

	// Initialize Three.js scene
	useEffect(() => {
		if (!containerRef.current) return;

		// Store container ref for cleanup
		const container = containerRef.current;

		// Scene setup
		const scene = new THREE.Scene();
		scene.background = new THREE.Color(0x0a0a0f);
		sceneRef.current = scene;

		// Camera setup
		const camera = new THREE.PerspectiveCamera(
			75,
			container.clientWidth / container.clientHeight,
			0.01,
			100
		);
		camera.position.set(0, 0, 3);
		cameraRef.current = camera;

		// Renderer setup
		const renderer = new THREE.WebGLRenderer({ antialias: true });
		renderer.setSize(
			container.clientWidth,
			container.clientHeight
		);
		renderer.setPixelRatio(window.devicePixelRatio);
		container.appendChild(renderer.domElement);
		rendererRef.current = renderer;

		// Controls
		const controls = new OrbitControls(camera, renderer.domElement);
		controls.enableDamping = true;
		controls.dampingFactor = 0.05;
		controlsRef.current = controls;

		// Lighting
		const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
		scene.add(ambientLight);

		const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
		directionalLight.position.set(0, 1, 1);
		scene.add(directionalLight);

		// Grid helper
		const gridHelper = new THREE.GridHelper(10, 10, 0x444444, 0x222222);
		scene.add(gridHelper);

		// Animation loop
		let animationFrameId;
		const animate = () => {
			animationFrameId = requestAnimationFrame(animate);
			controls.update();
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

			// Cancel animation frame
			if (animationFrameId) {
				cancelAnimationFrame(animationFrameId);
			}

			// Dispose controls
			if (controls) {
				controls.dispose();
			}

			// Dispose point cloud if exists
			if (pointCloudRef.current) {
				if (pointCloudRef.current.geometry) {
					pointCloudRef.current.geometry.dispose();
				}
				if (pointCloudRef.current.material) {
					pointCloudRef.current.material.dispose();
				}
				if (scene) {
					scene.remove(pointCloudRef.current);
				}
				pointCloudRef.current = null;
			}

			// Dispose scene objects
			if (scene) {
				scene.traverse((object) => {
					if (object.geometry) {
						object.geometry.dispose();
					}
					if (object.material) {
						if (Array.isArray(object.material)) {
							object.material.forEach(mat => mat.dispose());
						} else {
							object.material.dispose();
						}
					}
				});
				scene.clear();
			}

			// Dispose renderer
			if (renderer) {
				renderer.dispose();
			}

			// Remove canvas from DOM
			if (container && renderer && renderer.domElement) {
				try {
					container.removeChild(renderer.domElement);
				} catch (e) {
					// Element might already be removed
				}
			}

			// Clear refs
			sceneRef.current = null;
			rendererRef.current = null;
			cameraRef.current = null;
			controlsRef.current = null;
		};
	}, []);

	// Initialize Kinect sensor
	const handleInitialize = async () => {
		setIsInitializing(true);
		try {
			await kinectApi.initialize();
			const statusData = await kinectApi.getStatus();
			setStatus(statusData);
		} catch (err) {
			console.error("Failed to initialize Kinect:", err);
			alert("Failed to initialize Kinect sensor. Make sure it is connected.");
		} finally {
			setIsInitializing(false);
		}
	};

	// Connect to WebSocket (streaming starts automatically when first client connects)
	const handleConnect = async () => {
		// Prevent multiple connections
		if (hubConnectionRef.current || isConnecting) {
			console.log("[SignalR] Already connected or connecting");
			return;
		}

		setIsConnecting(true);
		try {
			console.log("[SignalR] Connecting to Kinect hub...");

			// Create SignalR connection
			const connection = new signalR.HubConnectionBuilder()
				.withUrl("http://localhost:5000/hubs/kinect")
				.withAutomaticReconnect()
				.configureLogging(signalR.LogLevel.Information)
				.build();

			// Handle incoming frames via WebSocket
			connection.on("ReceiveFrame", (frame) => {
				console.log("[SignalR] Received frame:", frame.pointCount, "points");
				updatePointCloud(frame);
			});

			// Handle status updates via WebSocket
			connection.on("ReceiveStatus", (statusData) => {
				console.log("[SignalR] Received status update:", statusData);
				setStatus(statusData);
			});

			// Handle connection events
			connection.onreconnecting(() => {
				console.log("[SignalR] Reconnecting...");
				setConnectionStatus("Reconnecting...");
			});

			connection.onreconnected(() => {
				console.log("[SignalR] Reconnected");
				setConnectionStatus("Connected");
			});

			connection.onclose(() => {
				console.log("[SignalR] Connection closed");
				setConnectionStatus("Disconnected");
			});

			// Start WebSocket connection (bridge streaming starts automatically)
			await connection.start();
			setConnectionStatus("Connected");
			console.log("[SignalR] Connected to Kinect hub via WebSocket");

			hubConnectionRef.current = connection;
		} catch (err) {
			console.error("[SignalR] Failed to connect:", err);
			setConnectionStatus("Error");
			alert(
				"Failed to connect to streaming. Make sure Kinect is initialized and API is running."
			);
		} finally {
			setIsConnecting(false);
		}
	};

	// Disconnect from WebSocket (streaming stops automatically when last client disconnects)
	const handleDisconnect = async () => {
		try {
			// Close WebSocket connection
			if (hubConnectionRef.current) {
				await hubConnectionRef.current.stop();
				hubConnectionRef.current = null;
				setConnectionStatus("Disconnected");
				console.log("[SignalR] WebSocket disconnected");
			}
		} catch (err) {
			console.error("Failed to disconnect:", err);
		}
	};

	// Update point cloud with new frame
	const updatePointCloud = (frame) => {
		console.log("[KINECT] updatePointCloud called with frame:", frame);

		if (!sceneRef.current) {
			console.error("[KINECT] Scene not initialized");
			return;
		}

		// Remove old point cloud
		if (pointCloudRef.current) {
			sceneRef.current.remove(pointCloudRef.current);
			pointCloudRef.current.geometry.dispose();
			pointCloudRef.current.material.dispose();
		}

		// Create new point cloud geometry
		const geometry = new THREE.BufferGeometry();

		// Set position attribute (X, Y, Z)
		const positions = new Float32Array(frame.points);
		console.log(
			"[KINECT] Created positions array:",
			positions.length,
			"floats"
		);
		geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

		// Decode colors from base64 string
		let colorBytes;
		if (typeof frame.colors === "string") {
			// Colors are base64 encoded - decode them
			console.log("[KINECT] Decoding base64 colors string");
			const base64 = frame.colors;
			const binaryString = atob(base64);
			colorBytes = new Uint8Array(binaryString.length);
			for (let i = 0; i < binaryString.length; i++) {
				colorBytes[i] = binaryString.charCodeAt(i);
			}
			console.log("[KINECT] Decoded", colorBytes.length, "color bytes");
		} else {
			// Colors are already an array
			colorBytes = new Uint8Array(frame.colors);
		}

		// Set color attribute (R, G, B) - normalize to 0-1
		const colors = new Float32Array(colorBytes.length);
		for (let i = 0; i < colorBytes.length; i++) {
			colors[i] = colorBytes[i] / 255.0;
		}
		console.log("[KINECT] Created colors array:", colors.length, "floats");
		geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

		// Create point cloud material
		const material = new THREE.PointsMaterial({
			size: 0.005,
			vertexColors: true,
			sizeAttenuation: true,
		});

		// Create point cloud mesh
		const pointCloud = new THREE.Points(geometry, material);
		pointCloudRef.current = pointCloud;

		sceneRef.current.add(pointCloud);
		console.log("[KINECT] Setting point count to:", frame.pointCount);
		setPointCount(frame.pointCount);
	};

	// Cleanup on unmount
	useEffect(() => {
		return () => {
			if (hubConnectionRef.current) {
				hubConnectionRef.current.stop().catch(console.error);
				hubConnectionRef.current = null;
			}
		};
	}, []);

	return (
		<div className="kinect-live-capture">
			<PageNav
				title="Kinect Live Capture"
				subtitle="Real-time point cloud streaming from Kinect v2"
			/>

			<div className="capture-content">
				{/* Control Panel */}
				<div className="control-panel">
					<div className="status-section">
						<h3>Sensor Status</h3>
						<div className="status-grid">
							<div className="status-item">
								<span className="status-label">Connection:</span>
								<span
									className={`status-value ${
										status.isConnected ? "connected" : "disconnected"
									}`}
								>
									{status.isConnected ? "● Connected" : "○ Disconnected"}
								</span>
							</div>
							<div className="status-item">
								<span className="status-label">Streaming:</span>
								<span
									className={`status-value ${
										status.isStreaming ? "streaming" : ""
									}`}
								>
									{status.isStreaming ? "● Active" : "○ Inactive"}
								</span>
							</div>
							<div className="status-item">
								<span className="status-label">WebSocket:</span>
								<span
									className={`status-value ${
										connectionStatus === "Connected" ? "connected" : ""
									}`}
								>
									{connectionStatus}
								</span>
							</div>
							<div className="status-item">
								<span className="status-label">FPS:</span>
								<span className="status-value">{status.fps.toFixed(1)}</span>
							</div>
							<div className="status-item">
								<span className="status-label">Total Frames:</span>
								<span className="status-value">
									{status.totalFrames.toLocaleString()}
								</span>
							</div>
							<div className="status-item">
								<span className="status-label">Point Count:</span>
								<span className="status-value">
									{pointCount.toLocaleString()}
								</span>
							</div>
							<div className="status-item">
								<span className="status-label">Status:</span>
								<span className="status-value">{status.statusMessage}</span>
							</div>
						</div>
						{status.errorMessage && (
							<div className="error-message">
								<strong>Error:</strong> {status.errorMessage}
							</div>
						)}
					</div>

					<div className="controls-section">
						<h3>Controls</h3>
						<div className="button-group">
							<button
								className="control-btn initialize-btn"
								onClick={handleInitialize}
								disabled={status.isConnected || isInitializing}
							>
								{isInitializing ? "Initializing..." : "Initialize Sensor"}
							</button>
							<button
								className="control-btn start-btn"
								onClick={handleConnect}
								disabled={
									!status.isConnected ||
									connectionStatus === "Connected" ||
									isConnecting
								}
							>
								{isConnecting ? "Connecting..." : "Connect to Stream"}
							</button>
							<button
								className="control-btn stop-btn"
								onClick={handleDisconnect}
								disabled={connectionStatus !== "Connected"}
							>
								Disconnect
							</button>
						</div>
					</div>
				</div>

				{/* 3D Viewer */}
				<div className="viewer-container" ref={containerRef}>
					{connectionStatus !== "Connected" && (
						<div className="viewer-overlay">
							<div className="overlay-content">
								<h2>Kinect Live Capture</h2>
								<p>
									Initialize the sensor and start streaming to see live point
									cloud data
								</p>
							</div>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}

export default KinectLiveCapture;
