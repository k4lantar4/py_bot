/**
 * API service for the 3X-UI Management System.
 * 
 * This module provides functions for communicating with the backend API.
 */

import axios from 'axios';

// Create axios instance with base URL and default headers
const apiClient = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:8000/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add request interceptor to include auth token in requests
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add response interceptor to handle token refresh
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    // If error is 401 and not already retrying
    if (error.response && error.response.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      try {
        // Try to refresh the token
        const refreshToken = localStorage.getItem('refreshToken');
        if (!refreshToken) {
          // No refresh token available, redirect to login
          window.location.href = '/auth/login';
          return Promise.reject(error);
        }
        
        // Call refresh token endpoint
        const response = await axios.post(
          `${process.env.REACT_APP_API_URL || 'http://localhost:8000/api/v1'}/auth/refresh-token`,
          { refresh_token: refreshToken },
          { headers: { 'Content-Type': 'application/json' } }
        );
        
        if (response.data) {
          // Store new tokens
          localStorage.setItem('accessToken', response.data.access_token);
          localStorage.setItem('refreshToken', response.data.refresh_token);
          
          // Retry original request with new token
          originalRequest.headers['Authorization'] = `Bearer ${response.data.access_token}`;
          return apiClient(originalRequest);
        }
      } catch (refreshError) {
        // Refresh token failed, redirect to login
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        window.location.href = '/auth/login';
        return Promise.reject(refreshError);
      }
    }
    
    return Promise.reject(error);
  }
);

// Authentication API
const authAPI = {
  /**
   * Set authentication token for API calls
   * @param {string} token - JWT token
   */
  setAuthToken: (token) => {
    if (token) {
      apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
      delete apiClient.defaults.headers.common['Authorization'];
    }
  },
  
  /**
   * Login user
   * @param {string} usernameOrEmail - Username or email
   * @param {string} password - User password
   * @returns {Promise} - Response with user data and tokens
   */
  login: async (usernameOrEmail, password) => {
    try {
      const response = await apiClient.post('/auth/login', {
        username_or_email: usernameOrEmail,
        password: password
      });
      
      return response.data;
    } catch (error) {
      console.error('Login API error:', error);
      throw error;
    }
  },
  
  /**
   * Register new user
   * @param {Object} userData - User registration data
   * @returns {Promise} - Response with user data
   */
  register: async (userData) => {
    const response = await apiClient.post('/auth/register', userData);
    return response.data;
  },
  
  /**
   * Logout user
   * @returns {Promise} - Logout response
   */
  logout: async () => {
    try {
      const response = await apiClient.post('/auth/logout');
      
      // Clean up local storage regardless of response
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('isAuthenticated');
      localStorage.removeItem('tokenExpiry');
      
      // Remove auth header
      delete apiClient.defaults.headers.common['Authorization'];
      
      return response.data;
    } catch (error) {
      // Still clean up on error
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('isAuthenticated');
      localStorage.removeItem('tokenExpiry');
      
      // Remove auth header
      delete apiClient.defaults.headers.common['Authorization'];
      
      throw error;
    }
  },
  
  /**
   * Reset password request
   * @param {string} email - User email
   * @returns {Promise} - Response data
   */
  requestPasswordReset: async (email) => {
    const response = await apiClient.post('/auth/reset-password', { email });
    return response.data;
  },
  
  /**
   * Confirm password reset with token
   * @param {string} token - Reset token
   * @param {string} newPassword - New password
   * @returns {Promise} - Response data
   */
  confirmPasswordReset: async (token, newPassword) => {
    const response = await apiClient.post('/auth/reset-password-confirm', {
      token,
      new_password: newPassword
    });
    return response.data;
  },
  
  /**
   * Get current user info
   * @returns {Promise} - User data
   */
  me: async () => {
    const response = await apiClient.get('/auth/me');
    return response.data;
  },
  
  /**
   * Refresh access token
   * @param {string} refreshToken - Refresh token
   * @returns {Promise} - New tokens
   */
  refreshToken: async (refreshToken) => {
    const response = await apiClient.post('/auth/refresh-token', { refresh_token: refreshToken });
    return response.data;
  }
};

// User API
const userAPI = {
  /**
   * Get current user profile.
   * 
   * @returns {Promise<Object>} User data
   */
  getProfile: async () => {
    const response = await apiClient.get('/users/me');
    return response.data;
  },
  
  /**
   * Update current user profile.
   * 
   * @param {Object} userData - User update data
   * @returns {Promise<Object>} Updated user data
   */
  updateProfile: async (userData) => {
    const response = await apiClient.put('/users/me', userData);
    return response.data;
  },
  
  /**
   * Get all users (admin only).
   * 
   * @param {number} page - Page number
   * @param {number} limit - Items per page
   * @returns {Promise<Array>} List of users
   */
  getUsers: async (page = 1, limit = 10) => {
    const skip = (page - 1) * limit;
    const response = await apiClient.get(`/users?skip=${skip}&limit=${limit}`);
    return response.data;
  },
  
  /**
   * Get a specific user by ID (admin only).
   * 
   * @param {number} userId - User ID
   * @returns {Promise<Object>} User data
   */
  getUserById: async (userId) => {
    const response = await apiClient.get(`/users/${userId}`);
    return response.data;
  },
  
  /**
   * Create a new user (admin only).
   * 
   * @param {Object} userData - User creation data
   * @returns {Promise<Object>} Created user data
   */
  createUser: async (userData) => {
    const response = await apiClient.post('/users', userData);
    return response.data;
  },
  
  /**
   * Update a user by ID (admin only).
   * 
   * @param {number} userId - User ID
   * @param {Object} userData - User update data
   * @returns {Promise<Object>} Updated user data
   */
  updateUser: async (userId, userData) => {
    const response = await apiClient.put(`/users/${userId}`, userData);
    return response.data;
  },
  
  /**
   * Delete a user by ID (admin only).
   * 
   * @param {number} userId - User ID
   * @returns {Promise<Object>} Deleted user data
   */
  deleteUser: async (userId) => {
    const response = await apiClient.delete(`/users/${userId}`);
    return response.data;
  },
  
  /**
   * Update a user's roles (admin only).
   * 
   * @param {number} userId - User ID
   * @param {Array<string>} roles - List of role names
   * @returns {Promise<Object>} Updated user data
   */
  updateUserRoles: async (userId, roles) => {
    const response = await apiClient.put(`/users/${userId}/roles`, { roles });
    return response.data;
  },
  
  /**
   * Update user wallet balance (admin only).
   * 
   * @param {number} userId - User ID
   * @param {number} amount - Amount to add or subtract
   * @param {string} operation - "add" or "subtract"
   * @returns {Promise<Object>} Updated user data
   */
  updateUserWallet: async (userId, amount, operation) => {
    const response = await apiClient.put(`/users/${userId}/wallet`, { 
      amount, 
      operation 
    });
    return response.data;
  },
  
  /**
   * Get current user's clients.
   * 
   * @param {number} page - Page number
   * @param {number} limit - Items per page
   * @returns {Promise<Array>} List of user clients
   */
  getMyClients: async (page = 1, limit = 10) => {
    const skip = (page - 1) * limit;
    const response = await apiClient.get(`/users/me/clients?skip=${skip}&limit=${limit}`);
    return response.data;
  },
};

// Role API
const roleAPI = {
  /**
   * Get all roles.
   * 
   * @returns {Promise<Array>} List of roles
   */
  getRoles: async () => {
    const response = await apiClient.get('/roles');
    return response.data;
  },
  
  /**
   * Create a new role (admin only).
   * 
   * @param {Object} roleData - Role creation data
   * @returns {Promise<Object>} Created role data
   */
  createRole: async (roleData) => {
    const response = await apiClient.post('/roles', roleData);
    return response.data;
  },
  
  /**
   * Update a role (admin only).
   * 
   * @param {number} roleId - Role ID
   * @param {Object} roleData - Role update data
   * @returns {Promise<Object>} Updated role data
   */
  updateRole: async (roleId, roleData) => {
    const response = await apiClient.put(`/roles/${roleId}`, roleData);
    return response.data;
  },
  
  /**
   * Delete a role (admin only).
   * 
   * @param {number} roleId - Role ID
   * @returns {Promise<Object>} Deleted role data
   */
  deleteRole: async (roleId) => {
    const response = await apiClient.delete(`/roles/${roleId}`);
    return response.data;
  },
};

// Dashboard API
const dashboardAPI = {
  /**
   * Get dashboard statistics.
   * 
   * @returns {Promise<Object>} Dashboard statistics
   */
  getStats: async () => {
    const response = await apiClient.get('/dashboard/stats');
    return response.data;
  },
  
  /**
   * Get recent activities.
   * 
   * @param {number} limit - Number of activities to fetch
   * @returns {Promise<Array>} List of recent activities
   */
  getRecentActivities: async (limit = 10) => {
    const response = await apiClient.get(`/dashboard/activities?limit=${limit}`);
    return response.data;
  },
};

// Export all API services
export { apiClient, authAPI, userAPI, roleAPI, dashboardAPI };

// Default export is the raw axios instance
export default apiClient; 