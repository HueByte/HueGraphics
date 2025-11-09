import React from "react";
import { Link } from "react-router-dom";
import { FaCube, FaRocket, FaPalette, FaBolt } from "react-icons/fa";
import { MdSpeed, MdViewInAr, MdControlCamera, MdLayers } from "react-icons/md";
import PointCloud from "../components/PointCloud";
import "./Home.css";

function Home() {
	const tools = [
		{
			id: "point-cloud-viewer",
			title: "3D Point Cloud Viewer",
			description:
				"Interactive visualization of 3D point cloud data with dynamic rendering and camera controls.",
			icon: <FaCube size={48} />,
			path: "/cloud-points",
			features: [
				{ text: "EPT Format Support", icon: <MdViewInAr /> },
				{ text: "Real-time Rendering", icon: <MdSpeed /> },
				{ text: "Camera Controls", icon: <MdControlCamera /> },
				{ text: "Dynamic LOD", icon: <MdLayers /> },
			],
		},
	];

	return (
		<>
			<PointCloud />
			<div className="home-container">
				<div className="hero-section fade-in">
					<div className="hero-content">
						<h1 className="hero-title">
							Welcome to <span className="brand-name">HueGraphics</span>
						</h1>
						<p className="hero-subtitle">
							Interactive 3D Visualization Platform
						</p>
						<p className="hero-description">
							Explore, visualize, and interact with 3D models and point cloud
							data using modern web technologies powered by Three.js and WebGL.
						</p>
					</div>

					<div className="info-section">
						<div className="info-card glass">
							<div className="info-icon"><FaRocket /></div>
							<h3>High Performance</h3>
							<p>
								Optimized rendering pipeline with dynamic level of detail for
								smooth performance
							</p>
						</div>
						<div className="info-card glass">
							<div className="info-icon"><FaPalette /></div>
							<h3>Beautiful Visuals</h3>
							<p>
								Stunning visual effects with support for colors, normals, and
								advanced materials
							</p>
						</div>
						<div className="info-card glass">
							<div className="info-icon"><FaBolt /></div>
							<h3>Modern Stack</h3>
							<p>
								Built with React, Three.js, and WebGL for cutting-edge web 3D
								experiences
							</p>
						</div>
					</div>
				</div>

				<div className="tools-section fade-in-delayed">
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
											{feature.icon}
											<span>{feature.text}</span>
										</span>
									))}
								</div>
								<div className="tool-action">Launch Tool →</div>
							</Link>
						))}
					</div>
				</div>
			</div>
		</>
	);
}

export default Home;
