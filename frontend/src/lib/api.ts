import axios from 'axios';
import type { AxiosInstance, AxiosRequestConfig } from 'axios';
import toast from 'react-hot-toast';

class ApiClient {
  private instance: AxiosInstance;

  constructor() {
    this.instance = axios.create({
      baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
    // Request interceptor
    this.instance.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem('auth_token');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.instance.interceptors.response.use(
      (response) => {
        return response;
      },
      (error) => {
        if (error.response?.status === 401) {
          // Clear auth token and redirect to login
          localStorage.removeItem('auth_token');
          localStorage.removeItem('user');
          window.location.href = '/login';
        }

        // Show more helpful error toast for network/timeouts
        if (error.response?.status !== 401) {
          const isNetwork = !!error.isAxiosError && !error.response;
          const message = isNetwork
            ? (error.message?.includes('timeout') ? 'Network timeout. Please try again.' : 'Network error. Check server and connection.')
            : (error.response?.data?.error || 'An unexpected error occurred');
          toast.error(message);
        }

        return Promise.reject(error);
      }
    );
  }

  async get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.instance.get(url, config);
    return response.data;
  }

  async post<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.instance.post(url, data, config);
    return response.data;
  }

  async put<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.instance.put(url, data, config);
    return response.data;
  }

  async delete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.instance.delete(url, config);
    return response.data;
  }

  async uploadFile<T>(url: string, formData: FormData, onProgress?: (progress: number) => void): Promise<T> {
    const response = await this.instance.post(url, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(progress);
        }
      },
    });
    return response.data;
  }

  // Set token for authenticated requests
  setAuthToken(token: string) {
    localStorage.setItem('auth_token', token);
  }

  // Clear auth token
  clearAuthToken() {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user');
  }

  // Get the base URL for file access
  getFileUrl(path: string): string {
    return `${import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000'}${path}`;
  }
}

export const apiClient = new ApiClient();

// Helper function to convert file to base64
export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });
};

// Helper function to convert canvas to base64
export const canvasToBase64 = (canvas: HTMLCanvasElement, quality = 0.8): string => {
  return canvas.toDataURL('image/jpeg', quality);
};

// Helper function to download file
export const downloadFile = (url: string, filename: string) => {
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
