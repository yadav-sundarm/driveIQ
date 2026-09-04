import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:5000/api",
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const getCategories = async () => {
  const response = await api.get("/categories");
  return response.data;
};

export const createCategory = async (data) => {
  const response = await api.post("/categories", data);
  return response.data;
};

export const updateCategory = async (id, data) => {
  const response = await api.patch(`/categories/${id}`, data);
  return response.data;
};

export const deleteCategory = async (id) => {
  const response = await api.delete(`/categories/${id}`);
  return response.data;
};
