import React from "react";
import { Link } from "react-router-dom";
import PointCloud from "../components/PointCloud";
import "./Home.css";

function Home() {
	const tools = [
		{
			id: "point-cloud-viewer",
			title: "3D Point Cloud Viewer",
			description:
				"Interactive visualization of 3D point cloud data with dynamic rendering and camera controls.",
			icon: "📊",
			path: "/cloud-points",
			features: [
				"EPT Format Support",
				"Real-time Rendering",
				"Camera Controls",
				"Dynamic LOD",
			],
		},
	];

	return (
		<>
			<PointCloud />
			<div className="home-container">
				<div className="hero-section glass">
					<div className="hero-content">
						<h1 className="hero-title">
							Welcome to <span className="brand-name">HueGraphics</span>
						</h1>
						<p className="hero-subtitle">
							Interactive 3D Visualization Platform
						</p>
						<p className="hero-description">
							Explore, visualize, and interact with 3D models and point cloud
							data using fancy web technologies powered by Three.js and WebGL.
						</p>
					</div>
				</div>

				<div className="tools-section">
					<h2 className="section-title">Available Tools</h2>
					<div className="tools-grid">
						{tools.map((tool) => (
							<Link key={tool.id} to={tool.path} className="tool-card glass">
								<div className="tool-icon">{tool.icon}</div>
								<h3 className="tool-title">{tool.title}</h3>
								<p className="tool-description">{tool.description}</p>
								<div className="tool-features">
									{tool.features.map((feature, index) => (
										<span key={index} className="feature-tag">
											{feature}
										</span>
									))}
								</div>
								<div className="tool-action">Launch Tool →</div>
							</Link>
						))}
					</div>
				</div>

				<div className="info-section">
					<div className="info-card glass">
						<h3>🚀 High Performance</h3>
						<p>
							Optimized rendering pipeline with dynamic level of detail for
							smooth performance
						</p>
					</div>
					<div className="info-card glass">
						<h3>🎨 Beautiful Visuals</h3>
						<p>
							Stunning visual effects with support for colors, normals, and
							advanced materials
						</p>
					</div>
					<div className="info-card glass">
						<h3>⚡ Modern Stack</h3>
						<p>
							Built with React, Three.js, and WebGL for cUtTinG-eDGe web 3D
							experiences
						</p>
					</div>
				</div>
			</div>
		</>
	);
}

export default Home;
