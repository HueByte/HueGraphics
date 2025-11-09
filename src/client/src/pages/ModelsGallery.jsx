import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { pointCloudApi } from '../services/api';
import { MdViewInAr, MdAccessTime, MdFolder } from 'react-icons/md';
import './ModelsGallery.css';

function ModelsGallery() {
	const [pointClouds, setPointClouds] = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);
	const navigate = useNavigate();

	useEffect(() => {
		fetchPointClouds();
	}, []);

	const fetchPointClouds = async () => {
		try {
			setLoading(true);
			const data = await pointCloudApi.getAllPointClouds();
			setPointClouds(data);
		} catch (err) {
			console.error('Failed to fetch point clouds:', err);
			setError(err.message);
		} finally {
			setLoading(false);
		}
	};

	const handleModelClick = (modelId) => {
		navigate(`/cloud-points?model=${modelId}`);
	};

	const formatDate = (dateString) => {
		const date = new Date(dateString);
		return date.toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'short',
			day: 'numeric'
		});
	};

	return (
		<div className="models-gallery-page">
			<div className="page-header">
				<h1>Models Gallery</h1>
				<p className="page-description">
					Browse and explore all uploaded 3D models. Click on any model to view it in the visualizer.
				</p>
			</div>

			{error && (
				<div className="error-message glass">
					<p>⚠️ Failed to load models: {error}</p>
					<p className="hint">Make sure the backend API is accessible</p>
				</div>
			)}

			{loading && (
				<div className="loading-container glass">
					<div className="loading-spinner"></div>
					<p>Loading models...</p>
				</div>
			)}

			{!loading && !error && (
				<div className="models-grid">
					{pointClouds.length === 0 ? (
						<div className="no-models glass">
							<MdFolder size={64} />
							<h3>No models yet</h3>
							<p>Upload some 3D models to get started!</p>
						</div>
					) : (
						pointClouds.map((model) => (
							<div
								key={model.id}
								className="model-card glass glass-hover"
								onClick={() => handleModelClick(model.id)}
							>
								<div className="model-icon">
									<MdViewInAr size={48} />
								</div>
								<div className="model-info">
									<h3 className="model-name">{model.name || model.sourceFile}</h3>
									{model.description && (
										<p className="model-description">{model.description}</p>
									)}
									<div className="model-meta">
										<div className="meta-item">
											<MdFolder size={16} />
											<span>{model.sourceFile}</span>
										</div>
										<div className="meta-item">
											<MdAccessTime size={16} />
											<span>{formatDate(model.createdAt)}</span>
										</div>
									</div>
									<div className="model-stats">
										<span className="stat-badge">
											{model.pointCount?.toLocaleString() || '0'} points
										</span>
										<span className="stat-badge format-badge">
											{model.format || 'EPT'}
										</span>
									</div>
								</div>
							</div>
						))
					)}
				</div>
			)}
		</div>
	);
}

export default ModelsGallery;
