const API_BASE_URL = 'http://localhost:5000/api';

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
};
