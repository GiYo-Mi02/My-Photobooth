export interface User {
  _id: string;
  username: string;
  email: string;
  role: 'user' | 'admin';
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface Photo {
  _id: string;
  sessionId: string;
  filename: string;
  originalName: string;
  path: string;
  size: number;
  mimeType: string;
  photoNumber: number;
  isSelected: boolean;
  filters: PhotoFilters;
  metadata: {
    width: number;
    height: number;
    format: string;
    colorSpace: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface PhotoFilters {
  brightness: number;
  contrast: number;
  saturation: number;
  blur: number;
  grayscale: boolean;
  sepia: boolean;
  vintage: boolean;
}

export interface Session {
  _id: string;
  sessionId: string;
  userId?: string;
  status: 'active' | 'completed' | 'cancelled';
  totalPhotos: number;
  selectedPhotos: string[];
  templateId?: string;
  photostripPath?: string;
  photosOnlyPath?: string; // diagnostic photos-only composite (no template/footer)
  finalCompositePath?: string; // always points to the full final composite from backend
  settings: SessionSettings;
  metadata: SessionMetadata;
  createdAt: string;
  updatedAt: string;
}

export interface SessionSettings {
  photoInterval: number;
  maxPhotos: number;
  autoAdvance: boolean;
}

export interface SessionMetadata {
  userAgent?: string;
  ipAddress?: string;
  startTime: string;
  endTime?: string;
  duration?: number;
}

export interface Template {
  _id: string;
  name: string;
  description?: string;
  filename: string;
  originalName: string;
  path: string;
  thumbnailPath?: string;
  size: number;
  mimeType: string;
  dimensions: {
    width: number;
    height: number;
  };
  photoSlots: PhotoSlot[];
  isActive: boolean;
  isDefault: boolean;
  category: 'classic' | 'modern' | 'fun' | 'elegant' | 'holiday' | 'custom';
  uploadedBy: string;
  usageCount: number;
  metadata: {
    colorMode?: string;
    dpi?: number;
    format?: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface PhotoSlot {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  borderRadius?: number;
}

export interface CameraState {
  isActive: boolean;
  stream: MediaStream | null;
  error: string | null;
  isCountingDown: boolean;
  countdown: number;
  flash: boolean;
}

export interface PhotoBoothState {
  session: Session | null;
  photos: Photo[];
  selectedPhotos: Photo[];
  currentTemplate: Template | null;
  isCapturing: boolean;
  currentPhotoNumber: number;
  stage: 'intro' | 'capture' | 'review' | 'template' | 'generate' | 'complete';
}

export interface ApiResponse<T> {
  message?: string;
  error?: string;
  data?: T;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    current: number;
    pages: number;
    total: number;
  };
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
  role?: 'user' | 'admin';
}

export interface PhotoUploadRequest {
  sessionId: string;
  photoNumber: number;
  base64Data?: string;
}

export interface TemplateUploadRequest {
  name: string;
  description?: string;
  category?: string;
  photoSlots: PhotoSlot[];
  isDefault?: boolean;
}
