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