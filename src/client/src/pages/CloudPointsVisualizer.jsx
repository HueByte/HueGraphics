import React, { useState, useEffect } from 'react';
import PointCloudBackground from '../components/PointCloudBackground';
import PageNav from '../components/PageNav';
import { pointCloudApi } from '../services/api';
import './CloudPointsVisualizer.css';

function CloudPointsVisualizer() {
  const [pointClouds, setPointClouds] = useState([]);
  const [selectedPointCloud, setSelectedPointCloud] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchPointClouds();
  }, []);

  const fetchPointClouds = async () => {
    try {
      setLoading(true);
      const data = await pointCloudApi.getAllPointClouds();
      setPointClouds(data);
      if (data.length > 0) {
        setSelectedPointCloud(data[0]);
      }
    } catch (err) {
      console.error('Failed to fetch point clouds:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPointCloud = (pointCloud) => {
    setSelectedPointCloud(pointCloud);
  };

  return (
    <div className="cloud-points-page">
      <PageNav
        title="Models"
        items={pointClouds.map((pc) => (
          <button
            key={pc.id}
            className={selectedPointCloud?.id === pc.id ? 'active' : ''}
            onClick={() => handleSelectPointCloud(pc)}
          >
            <div className="pc-name">{pc.sourceFile}</div>
            <div className="pc-meta">
              {pc.pointCount.toLocaleString()} pts
            </div>
          </button>
        ))}
      />

      <div className="page-header">
        <h1>Cloud Points Visualizer</h1>
        <p className="page-description">
          {selectedPointCloud ? (
            <>
              Viewing: <strong>{selectedPointCloud.sourceFile}</strong> ({selectedPointCloud.pointCount.toLocaleString()} points)
            </>
          ) : (
            'Interactive 3D point cloud visualization'
          )}
        </p>
      </div>

      {error && (
        <div className="error-message glass">
          <p>⚠️ Failed to load point clouds: {error}</p>
          <p className="hint">Make sure the backend API is accessible</p>
        </div>
      )}

      {loading && (
        <div className="loading-container glass">
          <div className="loading-spinner"></div>
          <p>Loading point cloud models...</p>
        </div>
      )}

      {!loading && !error && (
        <div className="visualizer-container">
          {selectedPointCloud ? (
            <PointCloudBackground pointCloudId={selectedPointCloud.id} />
          ) : (
            <div className="no-selection">
              <p>No point cloud models available.</p>
              <p className="hint">Run the model_parser CLI to generate point cloud data.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default CloudPointsVisualizer;
