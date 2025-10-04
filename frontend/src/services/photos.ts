import { apiClient } from '../lib/api';
import type { Photo, PhotoFilters, PhotoUploadRequest, SessionSettings } from '../types';

export const photoService = {
  // Upload photo (base64)
  async uploadPhoto(data: PhotoUploadRequest): Promise<{
    photo: Photo;
    session: {
      id: string;
      totalPhotos: number;
      status: string;
      remainingSlots?: number;
      nextPhotoNumber?: number;
      settings?: SessionSettings;
    };
    message: string;
  }> {
    return apiClient.post<{
      photo: Photo;
      session: {
        id: string;
        totalPhotos: number;
        status: string;
        remainingSlots?: number;
        nextPhotoNumber?: number;
        settings?: SessionSettings;
      };
      message: string;
    }>('/photos/upload', data);
  },

  // Upload photo (file)
  async uploadPhotoFile(sessionId: string, photoNumber: number, file: File): Promise<{
    photo: Photo;
    session: {
      id: string;
      totalPhotos: number;
      status: string;
    };
    message: string;
  }> {
    const formData = new FormData();
    formData.append('photo', file);
    formData.append('sessionId', sessionId);
    formData.append('photoNumber', photoNumber.toString());

    return apiClient.uploadFile<{
      photo: Photo;
      session: {
        id: string;
        totalPhotos: number;
        status: string;
      };
      message: string;
    }>('/photos/upload', formData);
  },

  // Get photos for a session
  async getSessionPhotos(sessionId: string): Promise<{
    session: {
      id: string;
      totalPhotos: number;
      status: string;
      selectedPhotos: string[];
    };
    photos: Photo[];
  }> {
    return apiClient.get<{
      session: {
        id: string;
        totalPhotos: number;
        status: string;
        selectedPhotos: string[];
      };
      photos: Photo[];
    }>(`/photos/session/${sessionId}`);
  },

  // Select/deselect photos for photostrip
  async selectPhotos(sessionId: string, photoIds: string[]): Promise<{
    message: string;
    selectedCount: number;
    photos: Photo[];
  }> {
    return apiClient.put<{
      message: string;
      selectedCount: number;
      photos: Photo[];
    }>('/photos/select', {
      sessionId,
      photoIds
    });
  },

  // Apply filters to a photo
  async applyFilters(photoId: string, filters: Partial<PhotoFilters>): Promise<{
    photo: Photo;
    message: string;
  }> {
    return apiClient.put<{
      photo: Photo;
      message: string;
    }>(`/photos/filter/${photoId}`, { filters });
  },

  // Delete a photo
  async deletePhoto(photoId: string): Promise<{ message: string }> {
    return apiClient.delete<{ message: string }>(`/photos/${photoId}`);
  },

  // Get all photos (admin only)
  async getAllPhotos(params?: { 
    page?: number; 
    limit?: number; 
    sessionId?: string;
  }): Promise<{
    photos: Photo[];
    pagination: {
      current: number;
      pages: number;
      total: number;
    };
  }> {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.sessionId) queryParams.append('sessionId', params.sessionId);

    return apiClient.get<{
      photos: Photo[];
      pagination: {
        current: number;
        pages: number;
        total: number;
      };
    }>(`/photos/all?${queryParams.toString()}`);
  },

  // Get photo URL
  getPhotoUrl(path: string): string {
    return apiClient.getFileUrl(path);
  }
};
