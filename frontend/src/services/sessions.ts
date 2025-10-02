import { apiClient } from '../lib/api';
import type { Session, SessionSettings } from '../types';

export const sessionService = {
  // Create new session
  async createSession(data?: { 
    userId?: string; 
    settings?: Partial<SessionSettings>; 
  }): Promise<{
    session: {
      id: string;
      settings: SessionSettings;
      status: string;
      createdAt: string;
    };
    message: string;
  }> {
    return apiClient.post<{
      session: {
        id: string;
        settings: SessionSettings;
        status: string;
        createdAt: string;
      };
      message: string;
    }>('/sessions/create', data);
  },

  // Get session details
  async getSession(sessionId: string): Promise<{
    session: {
      id: string;
      status: string;
      totalPhotos: number;
      selectedPhotos: string[];
      template: any;
      settings: SessionSettings;
      photostripPath?: string;
      createdAt: string;
      metadata: any;
    };
    photos: any[];
  }> {
    return apiClient.get<{
      session: {
        id: string;
        status: string;
        totalPhotos: number;
        selectedPhotos: string[];
        template: any;
        settings: SessionSettings;
        photostripPath?: string;
        createdAt: string;
        metadata: any;
      };
      photos: any[];
    }>(`/sessions/${sessionId}`);
  },

  // Update session
  async updateSession(sessionId: string, data: {
    status?: string;
    templateId?: string;
    selectedPhotos?: string[];
    settings?: Partial<SessionSettings>;
  }): Promise<{
    session: {
      id: string;
      status: string;
      totalPhotos: number;
      selectedPhotos: string[];
      template: any;
      photostripPath?: string;
      settings: SessionSettings;
      metadata: any;
    };
    message: string;
  }> {
    return apiClient.put<{
      session: {
        id: string;
        status: string;
        totalPhotos: number;
        selectedPhotos: string[];
        template: any;
        photostripPath?: string;
        settings: SessionSettings;
        metadata: any;
      };
      message: string;
    }>(`/sessions/${sessionId}`, data);
  },

  // Generate photostrip
  async generatePhotostrip(sessionId: string, data: {
    templateId: string;
    selectedPhotoIds: string[];
    targetWidth?: number;
    targetHeight?: number;
    forceOrientation?: 'portrait' | 'landscape';
    customization?: any;
  }): Promise<{
    photostrip: {
      path: string;
      url: string;
      template: string;
      photosUsed: number;
    };
    session: {
      id: string;
      status: string;
      photostripPath: string;
    };
    message: string;
  }> {
    return apiClient.post<{
      photostrip: {
        path: string;
        url: string;
        template: string;
        photosUsed: number;
      };
      session: {
        id: string;
        status: string;
        photostripPath: string;
      };
      message: string;
  }>(`/sessions/${sessionId}/photostrip`, data);
  },

  // Get all sessions (admin only)
  async getAllSessions(params?: {
    page?: number;
    limit?: number;
    status?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<{
    sessions: Session[];
    stats: Array<{
      _id: string;
      count: number;
      avgPhotos: number;
      avgDuration: number;
    }>;
    pagination: {
      current: number;
      pages: number;
      total: number;
    };
  }> {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.status) queryParams.append('status', params.status);
    if (params?.startDate) queryParams.append('startDate', params.startDate);
    if (params?.endDate) queryParams.append('endDate', params.endDate);

    return apiClient.get<{
      sessions: Session[];
      stats: Array<{
        _id: string;
        count: number;
        avgPhotos: number;
        avgDuration: number;
      }>;
      pagination: {
        current: number;
        pages: number;
        total: number;
      };
    }>(`/sessions/all/list?${queryParams.toString()}`);
  },

  // Delete session (admin only)
  async deleteSession(sessionId: string): Promise<{ message: string }> {
    return apiClient.delete<{ message: string }>(`/sessions/${sessionId}`);
  },

  // Generate unique session ID
  generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
};
