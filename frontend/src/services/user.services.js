import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:5000/api",
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const getThreshold = async () => {
  const response = await api.get("/users/me/threshold");
  return response.data;
};

export const updateThreshold = async (confidenceThreshold) => {
  const response = await api.patch("/users/me/threshold", {
    confidenceThreshold,
  });
  return response.data;
};
