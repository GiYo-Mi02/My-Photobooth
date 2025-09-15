import { apiClient } from '../lib/api';
import type { 
  User, 
  LoginRequest, 
  RegisterRequest
} from '../types';

export const authService = {
  // Login user
  async login(credentials: LoginRequest): Promise<{ user: User; token: string; message: string }> {
    const response = await apiClient.post<{ user: User; token: string; message: string }>('/auth/login', credentials);
    
    // Store token and user data
    apiClient.setAuthToken(response.token);
    localStorage.setItem('user', JSON.stringify(response.user));
    
    return response;
  },

  // Register user
  async register(userData: RegisterRequest): Promise<{ user: User; token: string; message: string }> {
    const response = await apiClient.post<{ user: User; token: string; message: string }>('/auth/register', userData);
    
    // Store token and user data
    apiClient.setAuthToken(response.token);
    localStorage.setItem('user', JSON.stringify(response.user));
    
    return response;
  },

  // Get current user
  async getCurrentUser(): Promise<{ user: User }> {
    return apiClient.get<{ user: User }>('/auth/me');
  },

  // Update user profile
  async updateProfile(userData: Partial<User>): Promise<{ user: User; message: string }> {
    return apiClient.put<{ user: User; message: string }>('/auth/profile', userData);
  },

  // Logout user
  async logout(): Promise<void> {
    apiClient.clearAuthToken();
  },

  // Get all users (admin only)
  async getAllUsers(params?: { page?: number; limit?: number; search?: string }): Promise<{
    users: User[];
    pagination: {
      current: number;
      pages: number;
      total: number;
    };
  }> {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.search) queryParams.append('search', params.search);

    return apiClient.get<{
      users: User[];
      pagination: {
        current: number;
        pages: number;
        total: number;
      };
    }>(`/auth/users?${queryParams.toString()}`);
  },

  // Check if user is authenticated
  isAuthenticated(): boolean {
    const token = localStorage.getItem('auth_token');
    const user = localStorage.getItem('user');
    return !!(token && user);
  },

  // Get stored user data
  getStoredUser(): User | null {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        return JSON.parse(userStr);
      } catch (error) {
        console.error('Error parsing stored user data:', error);
        return null;
      }
    }
    return null;
  },

  // Get stored token
  getStoredToken(): string | null {
    return localStorage.getItem('auth_token');
  }
};
