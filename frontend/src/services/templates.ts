import { apiClient } from '../lib/api';
import type { Template, TemplateUploadRequest } from '../types';

export const templateService = {
  // Get all active templates
  async getTemplates(params?: { 
    category?: string; 
    page?: number; 
    limit?: number;
  }): Promise<{
    templates: Template[];
    categories: string[];
    pagination: {
      current: number;
      pages: number;
      total: number;
    };
  }> {
    const queryParams = new URLSearchParams();
    if (params?.category) queryParams.append('category', params.category);
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());

    return apiClient.get<{
      templates: Template[];
      categories: string[];
      pagination: {
        current: number;
        pages: number;
        total: number;
      };
    }>(`/templates?${queryParams.toString()}`);
  },

  // Get template by ID
  async getTemplate(id: string): Promise<{ template: Template }> {
    return apiClient.get<{ template: Template }>(`/templates/${id}`);
  },

  // Upload new template (admin only)
  async uploadTemplate(
    file: File, 
    data: TemplateUploadRequest,
    onProgress?: (progress: number) => void
  ): Promise<{
    template: Template;
    message: string;
  }> {
    const formData = new FormData();
    formData.append('template', file);
    formData.append('name', data.name);
  if (data.description) formData.append('description', data.description);
    if (data.category) formData.append('category', data.category);
    formData.append('photoSlots', JSON.stringify(data.photoSlots));
    if (data.isDefault) formData.append('isDefault', data.isDefault.toString());
  if ((data as any).layoutJson) formData.append('layoutJson', (data as any).layoutJson);

    return apiClient.uploadFile<{
      template: Template;
      message: string;
    }>('/templates/upload', formData, onProgress);
  },

  // Update template (admin only)
  async updateTemplate(id: string, data: Partial<TemplateUploadRequest>): Promise<{
    template: Template;
    message: string;
  }> {
    return apiClient.put<{
      template: Template;
      message: string;
    }>(`/templates/${id}`, data);
  },

  // Delete template (admin only)
  async deleteTemplate(id: string): Promise<{ message: string }> {
    return apiClient.delete<{ message: string }>(`/templates/${id}`);
  },

  // Record template usage
  async recordUsage(id: string): Promise<{
    message: string;
    usageCount: number;
  }> {
    return apiClient.post<{
      message: string;
      usageCount: number;
    }>(`/templates/${id}/use`);
  },

  // Get template categories
  async getCategories(): Promise<{
    categories: Array<{
      value: string;
      label: string;
      count: number;
    }>;
  }> {
    return apiClient.get<{
      categories: Array<{
        value: string;
        label: string;
        count: number;
      }>;
    }>('/templates/categories/list');
  },

  // Get template URL
  getTemplateUrl(path: string): string {
    return apiClient.getFileUrl(path);
  },

  // Get template thumbnail URL
  getThumbnailUrl(path: string): string {
    return apiClient.getFileUrl(path);
  }
};
