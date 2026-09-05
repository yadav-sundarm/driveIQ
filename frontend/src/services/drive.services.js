import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:5000/api",
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const getPendingActions = async () => {
  const response = await api.get("/files/pending");
  return response.data;
};

export const confirmAction = async (id) => {
  const response = await api.patch(`/files/${id}/confirm`);
  return response.data;
};

export const rejectAction = async (id) => {
  const response = await api.patch(`/files/${id}/reject`);
  return response.data;
};

export const getFileHistory = async () => {
  const response = await api.get("/files/history");
  return response.data;
};

export const triggerPoll = async () => {
  const response = await api.post("/files/poll-now");
  return response.data;
};

export const scanExisting = async () => {
  const response = await api.post("/files/scan");
  return response.data;
};

export const verifyOrganization = async () => {
  const response = await api.post("/files/verify");
  return response.data;
};
