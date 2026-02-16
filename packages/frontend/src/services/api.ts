import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

export const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Don't retry refresh requests to avoid infinite loop
    if (originalRequest.url?.includes('/auth/refresh')) {
      return Promise.reject(error);
    }

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const response = await api.post('/api/v1/auth/refresh');
        const { accessToken } = response.data;

        localStorage.setItem('accessToken', accessToken);
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;

        return api(originalRequest);
      } catch (refreshError) {
        localStorage.removeItem('accessToken');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

// Template API
export const templateAPI = {
  getAll: (includeInactive = false) =>
    api.get(`/api/v1/templates`, { params: { includeInactive } }),
  getById: (id: string) => api.get(`/api/v1/templates/${id}`),
  create: (data: any) => api.post(`/api/v1/templates`, data),
  update: (id: string, data: any) => api.put(`/api/v1/templates/${id}`, data),
  delete: (id: string) => api.delete(`/api/v1/templates/${id}`),
  addExercise: (id: string, data: any) =>
    api.post(`/api/v1/templates/${id}/exercises`, data),
  removeExercise: (id: string, exerciseId: string) =>
    api.delete(`/api/v1/templates/${id}/exercises/${exerciseId}`),
  updateExercise: (id: string, exerciseId: string, data: any) =>
    api.put(`/api/v1/templates/${id}/exercises/${exerciseId}`, data),
  reorderExercises: (id: string, exerciseIds: string[]) =>
    api.put(`/api/v1/templates/${id}/exercises/reorder`, { exerciseIds }),
};

// Schedule API
export const scheduleAPI = {
  getWeekly: () => api.get(`/api/v1/schedule/week`),
  getToday: () => api.get(`/api/v1/schedule/today`),
  getMonth: (year: number, month: number) =>
    api.get(`/api/v1/schedule/month/${year}/${month}`),
  setSchedule: (dayOfWeek: number, templateId: string) =>
    api.post(`/api/v1/schedule`, { dayOfWeek, templateId }),
  clearSchedule: (dayOfWeek: number) =>
    api.delete(`/api/v1/schedule/${dayOfWeek}`),
};

// Analytics API
export const analyticsAPI = {
  getExerciseProgression: (exerciseId: string, range: string) =>
    api.get(`/api/v1/analytics/exercise/${exerciseId}/progression`, {
      params: { range },
    }),
  getVolumeByWeek: (weeks = 12) =>
    api.get(`/api/v1/analytics/volume/weekly`, { params: { weeks } }),
  getWorkoutFrequency: (weeks = 12) =>
    api.get(`/api/v1/analytics/frequency`, { params: { weeks } }),
  getMuscleDistribution: (range = '3months') =>
    api.get(`/api/v1/analytics/muscle-distribution`, { params: { range } }),
  getPersonalRecords: () => api.get(`/api/v1/analytics/personal-records`),
  getStreak: () => api.get(`/api/v1/analytics/streak`),
  getVolumeComparison: () => api.get(`/api/v1/analytics/volume/comparison`),
  getRecentPRs: (limit = 5) =>
    api.get(`/api/v1/analytics/recent-prs`, { params: { limit } }),
  getMonthlySummary: () => api.get(`/api/v1/analytics/monthly-summary`),
  getRecentActivity: (limit = 5) =>
    api.get(`/api/v1/analytics/recent-activity`, { params: { limit } }),
};

// Workout API - add new endpoint
export const workoutAPI = {
  getActive: () => api.get(`/api/v1/workouts/active`),
  createFromTemplate: (templateId: string, startDate?: string) =>
    api.post(`/api/v1/workouts/from-template`, { templateId, ...(startDate && { startDate }) }),
};

// Exercise API
export const exerciseAPI = {
  getAll: () => api.get('/api/v1/exercises'),
  getById: (id: string) => api.get(`/api/v1/exercises/${id}`),
  getMuscleGroups: () => api.get('/api/v1/exercises/muscle-groups'),
  getCategories: () => api.get('/api/v1/exercises/categories'),
  create: (data: any) => api.post('/api/v1/exercises', data),
  update: (id: string, data: any) => api.put(`/api/v1/exercises/${id}`, data),
  delete: (id: string) => api.delete(`/api/v1/exercises/${id}`),
  // Admin endpoints
  admin: {
    createGlobal: (data: any) => api.post('/api/v1/exercises/admin/global', data),
    update: (id: string, data: any) => api.put(`/api/v1/exercises/admin/${id}`, data),
    delete: (id: string) => api.delete(`/api/v1/exercises/admin/${id}`),
  },
};

// Progression API
export const progressionAPI = {
  getForExercise: (exerciseId: string) =>
    api.get(`/api/v1/progression/exercises/${exerciseId}`),
  getRecommendations: () => api.get('/api/v1/progression/recommendations'),
  resetExercise: (exerciseId: string) =>
    api.delete(`/api/v1/progression/exercises/${exerciseId}`),
  resetAll: () => api.delete('/api/v1/progression'),
};

// Admin Metadata API
export const adminAPI = {
  // Muscle Groups
  muscleGroups: {
    getAll: () => api.get('/api/v1/admin/muscle-groups'),
    create: (name: string) => api.post('/api/v1/admin/muscle-groups', { name }),
    update: (id: string, name: string) => api.put(`/api/v1/admin/muscle-groups/${id}`, { name }),
    delete: (id: string) => api.delete(`/api/v1/admin/muscle-groups/${id}`),
  },
  // Categories
  categories: {
    getAll: () => api.get('/api/v1/admin/categories'),
    create: (name: string) => api.post('/api/v1/admin/categories', { name }),
    update: (id: string, name: string) => api.put(`/api/v1/admin/categories/${id}`, { name }),
    delete: (id: string) => api.delete(`/api/v1/admin/categories/${id}`),
  },
  // Users
  users: {
    getAll: () => api.get('/api/v1/admin/users'),
    updateRole: (id: string, role: string) => api.put(`/api/v1/admin/users/${id}/role`, { role }),
  },
};

// AI Plan Generator API
export const aiAPI = {
  generatePlan: (data: any) =>
    api.post('/api/v1/ai/generate-plan', data, { timeout: 310_000 }),
};

export default api;
