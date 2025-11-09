import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import PointCloudBackground from '../components/PointCloudBackground';
import PageNav from '../components/PageNav';
import { pointCloudApi } from '../services/api';
import './CloudPointsVisualizer.css';

function CloudPointsVisualizer() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [pointClouds, setPointClouds] = useState([]);
  const [selectedPointCloud, setSelectedPointCloud] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [processingStatuses, setProcessingStatuses] = useState({});

  useEffect(() => {
    fetchPointClouds();
  }, []);

  useEffect(() => {
    // Don't poll if no point clouds
    if (pointClouds.length === 0) return;

    // Check if all models have completed processing
    const allCompleted = pointClouds.every((pc) => {
      const status = processingStatuses[pc.guid];
      return !status || status.status === 'completed' || status.status === 'failed';
    });

    // Stop polling if all models are completed
    if (allCompleted && Object.keys(processingStatuses).length > 0) {
      console.log('All models completed, stopping status polling');
      return;
    }

    // Poll for processing statuses using bulk API
    const interval = setInterval(async () => {
      try {
        // Get GUIDs of all point clouds
        const guids = pointClouds.map(pc => pc.guid).filter(Boolean);

        if (guids.length === 0) return;

        // Fetch statuses in bulk
        const bulkStatuses = await pointCloudApi.getBulkProcessingStatus(guids);

        // Convert from GUID-keyed object to a more convenient format
        const statusMap = {};
        Object.entries(bulkStatuses).forEach(([guid, status]) => {
          statusMap[guid] = status;
        });

        setProcessingStatuses(statusMap);
      } catch (err) {
        console.error('Failed to fetch bulk processing status:', err);
      }
    }, 2000); // Poll every 2 seconds

    return () => clearInterval(interval);
  }, [pointClouds, processingStatuses]);

  // Select model from URL parameter when point clouds are loaded
  useEffect(() => {
    if (pointClouds.length === 0) return;

    const modelId = searchParams.get('model');

    if (modelId) {
      // Try to find model by ID from URL
      const model = pointClouds.find(pc => pc.id === modelId);
      if (model) {
        const status = processingStatuses[model.guid];
        // Only select if not processing
        if (!status || status.status === 'completed') {
          setSelectedPointCloud(model);
          return;
        }
      }
    }

    // Default to first model if no URL parameter or model not found
    if (!selectedPointCloud && pointClouds.length > 0) {
      setSelectedPointCloud(pointClouds[0]);
      setSearchParams({ model: pointClouds[0].id });
    }
  }, [pointClouds, searchParams, processingStatuses]);

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

  const handleSelectPointCloud = (pointCloud) => {
    const status = processingStatuses[pointCloud.guid];
    // Don't allow selection if model is still processing
    if (status && status.status !== 'completed') {
      return;
    }
    setSelectedPointCloud(pointCloud);
    // Update URL with selected model ID
    setSearchParams({ model: pointCloud.id });
  };

  return (
    <div className="cloud-points-page">
      <PageNav
        title="Models"
        items={pointClouds.map((pc) => {
          const status = processingStatuses[pc.guid];
          const isProcessing = status && (status.status === 'pending' || status.status === 'processing');
          const isFailed = status && status.status === 'failed';

          return (
            <button
              key={pc.id}
              className={`${selectedPointCloud?.id === pc.id ? 'active' : ''} ${isProcessing ? 'processing' : ''} ${isFailed ? 'failed' : ''}`}
              onClick={() => handleSelectPointCloud(pc)}
              disabled={isProcessing || isFailed}
            >
              <div className="pc-name">{pc.sourceFile}</div>
              <div className="pc-meta">
                {isProcessing ? (
                  <span className="status-badge processing">
                    Processing {status.progress}%
                  </span>
                ) : isFailed ? (
                  <span className="status-badge failed">
                    Failed
                  </span>
                ) : (
                  `${pc.pointCount?.toLocaleString() || 0} pts`
                )}
              </div>
            </button>
          );
        })}
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
