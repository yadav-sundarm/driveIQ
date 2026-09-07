import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:5000/api/tree",
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const getChildren = async (nodeId) => {
  const response = await api.get(`/${nodeId}/children`);
  return response.data;
};

export const refreshNode = async (nodeId) => {
  const response = await api.post(`/${nodeId}/refresh`);
  return response.data;
};

export const createFolder = async (nodeId, name) => {
  const response = await api.post(`/${nodeId}/folder`, { name });
  return response.data;
};

export const deleteNode = async (nodeId) => {
  const response = await api.delete(`/${nodeId}`);
  return response.data;
};

export const renameNode = async (nodeId, name) => {
  const response = await api.patch(`/${nodeId}/rename`, { name });
  return response.data;
};

export const moveNode = async (nodeId, newParentId) => {
  const response = await api.patch(`/${nodeId}/move`, { newParentId });
  return response.data;
};
