const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

export const pointCloudApi = {
  async getAllPointClouds() {
    const response = await fetch(`${API_BASE_URL}/pointcloud`);
    if (!response.ok) {
      throw new Error('Failed to fetch point clouds');
    }
    return response.json();
  },

  async getPointCloudMetadata(id) {
    const response = await fetch(`${API_BASE_URL}/pointcloud/${id}/metadata`);
    if (!response.ok) {
      throw new Error(`Failed to fetch metadata for ${id}`);
    }
    return response.json();
  },

  async getPointCloudData(id) {
    const response = await fetch(`${API_BASE_URL}/pointcloud/${id}/data`);
    if (!response.ok) {
      throw new Error(`Failed to fetch data for ${id}`);
    }
    return response.json();
  },

  async getEptMetadata(id) {
    const response = await fetch(`${API_BASE_URL}/pointcloud/${id}/ept.json`);
    if (!response.ok) {
      throw new Error(`Failed to fetch EPT metadata for ${id}`);
    }
    return response.json();
  },

  async getEptTile(id, tile) {
    const response = await fetch(`${API_BASE_URL}/pointcloud/${id}/ept-data/${tile}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch EPT tile ${tile}`);
    }
    return response.arrayBuffer();
  },

  async getEptHierarchy(id, tile) {
    const response = await fetch(`${API_BASE_URL}/pointcloud/${id}/ept-hierarchy/${tile}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch EPT hierarchy ${tile}`);
    }
    return response.json();
  },

  async getProcessingStatus(id) {
    const response = await fetch(`${API_BASE_URL}/pointcloud/${id}/status`);
    if (!response.ok) {
      if (response.status === 404) {
        return null; // No status found
      }
      throw new Error(`Failed to fetch processing status for ${id}`);
    }
    const data = await response.json();
    return data.data;
  },

  async getBulkProcessingStatus(guids) {
    const response = await fetch(`${API_BASE_URL}/pointcloud/status/bulk`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(guids),
    });
    if (!response.ok) {
      throw new Error('Failed to fetch bulk processing status');
    }
    const data = await response.json();
    return data.data;
  },
};

export const kinectApi = {
  async initialize() {
    const response = await fetch(`${API_BASE_URL}/kinect/initialize`, {
      method: 'POST',
    });
    if (!response.ok) {
      throw new Error('Failed to initialize Kinect sensor');
    }
    return response.json();
  },

  async startStreaming() {
    const response = await fetch(`${API_BASE_URL}/kinect/start`, {
      method: 'POST',
    });
    if (!response.ok) {
      throw new Error('Failed to start Kinect streaming');
    }
    return response.json();
  },

  async stopStreaming() {
    const response = await fetch(`${API_BASE_URL}/kinect/stop`, {
      method: 'POST',
    });
    if (!response.ok) {
      throw new Error('Failed to stop Kinect streaming');
    }
    return response.json();
  },

  async getStatus() {
    const response = await fetch(`${API_BASE_URL}/kinect/status`);
    if (!response.ok) {
      throw new Error('Failed to fetch Kinect status');
    }
    return response.json();
  },

  async getLatestFrame() {
    const response = await fetch(`${API_BASE_URL}/kinect/frame`);
    if (!response.ok) {
      if (response.status === 404) {
        return null; // No frame available
      }
      throw new Error('Failed to fetch Kinect frame');
    }
    return response.json();
  },

  // Connect to SSE stream
  createStreamConnection(onFrame, onError) {
    const eventSource = new EventSource(`${API_BASE_URL}/kinect/stream`);

    eventSource.onmessage = (event) => {
      try {
        const frame = JSON.parse(event.data);
        onFrame(frame);
      } catch (err) {
        console.error('Error parsing frame data:', err);
        onError(err);
      }
    };

    eventSource.onerror = (error) => {
      console.error('SSE connection error:', error);
      onError(error);
      eventSource.close();
    };

    return eventSource;
  },
};
