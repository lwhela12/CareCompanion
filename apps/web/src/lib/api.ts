import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

// Function to manually set auth token
export async function setAuthToken() {
  try {
    // @ts-ignore - Clerk is loaded globally
    if (window.Clerk && window.Clerk.session) {
      const token = await window.Clerk.session.getToken();
      if (token) {
        api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      }
    }
  } catch (error) {
    console.error('Failed to set auth token:', error);
  }
}

// Add auth token to requests
api.interceptors.request.use(
  async (config) => {
    // Try to get fresh token for each request
    try {
      // @ts-ignore - Clerk is loaded globally
      if (window.Clerk && window.Clerk.session) {
        const token = await window.Clerk.session.getToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
      }
    } catch (error) {
      console.error('Failed to get auth token:', error);
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Redirect to sign in
      window.location.href = '/sign-in';
    }
    return Promise.reject(error);
  }
);

// Recommendations API
export const recommendationsApi = {
  getAll: (params?: { status?: string; type?: string; priority?: string }) =>
    api.get('/api/v1/recommendations', { params }),

  getById: (id: string) =>
    api.get(`/api/v1/recommendations/${id}`),

  update: (id: string, data: any) =>
    api.put(`/api/v1/recommendations/${id}`, data),

  acknowledge: (id: string) =>
    api.post(`/api/v1/recommendations/${id}/acknowledge`),

  accept: (id: string, data: any) =>
    api.post(`/api/v1/recommendations/${id}/accept`, data),

  dismiss: (id: string, reason?: string) =>
    api.post(`/api/v1/recommendations/${id}/dismiss`, { reason }),

  bulkAccept: (recommendationIds: string[], acceptanceData: Record<string, any>) =>
    api.post('/api/v1/recommendations/bulk-accept', { recommendationIds, acceptanceData }),
};

// Providers API
export const providersApi = {
  getAll: (params?: { type?: string; isActive?: boolean }) =>
    api.get('/api/v1/providers', { params }),

  getById: (id: string) =>
    api.get(`/api/v1/providers/${id}`),

  create: (data: any) =>
    api.post('/api/v1/providers', data),

  update: (id: string, data: any) =>
    api.put(`/api/v1/providers/${id}`, data),

  setPrimary: (id: string) =>
    api.patch(`/api/v1/providers/${id}/primary`),

  delete: (id: string) =>
    api.delete(`/api/v1/providers/${id}`),
};