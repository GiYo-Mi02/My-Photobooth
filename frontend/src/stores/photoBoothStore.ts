import { create } from 'zustand';
import type { Template, PhotoBoothState } from '../types';
import { sessionService } from '../services/sessions';
import { photoService } from '../services/photos';

interface PhotoBoothStore extends PhotoBoothState {
  // Actions
  createSession: () => Promise<void>;
  loadSession: (sessionId: string) => Promise<void>;
  uploadPhoto: (photoNumber: number, base64Data: string) => Promise<void>;
  selectPhoto: (photoId: string) => void;
  deselectPhoto: (photoId: string) => void;
  selectMultiplePhotos: (photoIds: string[]) => Promise<void>;
  setTemplate: (template: Template) => void;
  updatePhotoInterval: (ms: number) => Promise<void>;
  generatePhotostrip: () => Promise<string>;
  generatePhotostripLandscape: () => Promise<string>;
  generatePhotostripPortrait: () => Promise<string>;
  generatePhotostrip16: () => Promise<string>;
  nextStage: () => void;
  previousStage: () => void;
  setStage: (stage: PhotoBoothState['stage']) => void;
  resetSession: () => void;
  startCapturing: () => void;
  stopCapturing: () => void;
  setCurrentPhotoNumber: (number: number) => void;
}

const initialState: PhotoBoothState = {
  session: null,
  photos: [],
  selectedPhotos: [],
  currentTemplate: null,
  isCapturing: false,
  currentPhotoNumber: 1,
  stage: 'intro',
};

export const usePhotoBoothStore = create<PhotoBoothStore>((set, get) => ({
  ...initialState,

  createSession: async () => {
    try {
      const response = await sessionService.createSession();
      set({
        session: {
          _id: '',
          sessionId: response.session.id,
          status: response.session.status as 'active',
          totalPhotos: 0,
          selectedPhotos: [],
          settings: response.session.settings,
          metadata: {
            startTime: response.session.createdAt,
          },
          createdAt: response.session.createdAt,
          updatedAt: response.session.createdAt,
        },
        stage: 'capture',
      });
    } catch (error) {
      console.error('Failed to create session:', error);
      throw error;
    }
  },

  loadSession: async (sessionId: string) => {
    try {
      const response = await sessionService.getSession(sessionId);
      const session = response.session;
      
      set({
        session: {
          _id: '',
          sessionId: session.id,
          status: session.status as 'active' | 'completed' | 'cancelled',
          totalPhotos: session.totalPhotos,
          selectedPhotos: session.selectedPhotos,
          templateId: session.template?._id,
          photostripPath: session.photostripPath,
          settings: session.settings,
          metadata: session.metadata,
          createdAt: session.createdAt,
          updatedAt: session.createdAt,
        },
        photos: response.photos,
        currentPhotoNumber: session.totalPhotos + 1,
        stage: session.status === 'completed' && session.photostripPath ? 'complete' : 
               session.totalPhotos >= 10 ? 'review' : 'capture',
      });
    } catch (error) {
      console.error('Failed to load session:', error);
      throw error;
    }
  },

  uploadPhoto: async (photoNumber: number, base64Data: string) => {
    const { session } = get();
    if (!session) throw new Error('No active session');

    try {
      const response = await photoService.uploadPhoto({
        sessionId: session.sessionId,
        photoNumber,
        base64Data,
      });

      set((state) => ({
        photos: [...state.photos, response.photo],
        session: state.session ? {
          ...state.session,
          totalPhotos: response.session.totalPhotos,
          status: response.session.status as 'active' | 'completed' | 'cancelled',
        } : null,
        currentPhotoNumber: Math.min(11, (response.session.totalPhotos || 0) + 1),
      }));

      // Move to review stage if we've taken 10 photos
      if (response.session.totalPhotos >= 10) {
        set({ stage: 'review' });
      }
    } catch (error) {
      console.error('Failed to upload photo:', error);
      throw error;
    }
  },

  selectPhoto: (photoId: string) => {
    const { photos, selectedPhotos } = get();
    const photo = photos.find(p => p._id === photoId);
    
    if (photo && !selectedPhotos.find(p => p._id === photoId)) {
      set({
        selectedPhotos: [...selectedPhotos, photo],
      });
    }
  },

  deselectPhoto: (photoId: string) => {
    const { selectedPhotos } = get();
    set({
      selectedPhotos: selectedPhotos.filter(p => p._id !== photoId),
    });
  },

  selectMultiplePhotos: async (photoIds: string[]) => {
    const { session, photos } = get();
    if (!session) throw new Error('No active session');

    try {
      await photoService.selectPhotos(session.sessionId, photoIds);
      
      const selectedPhotos = photos.filter(photo => photoIds.includes(photo._id));
      set({ selectedPhotos });
    } catch (error) {
      console.error('Failed to select photos:', error);
      throw error;
    }
  },

  setTemplate: (template: Template) => {
    set({ currentTemplate: template });
  },

  updatePhotoInterval: async (ms: number) => {
    const { session } = get();
    if (!session) throw new Error('No active session');
    try {
      const safeInterval = Math.min(Math.max(ms, 1000), 60000);
      const response = await sessionService.updateSession(session.sessionId, {
        settings: { photoInterval: safeInterval },
      });
      set((state) => ({
        session: state.session ? {
          ...state.session,
          settings: {
            ...state.session.settings,
            ...response.session.settings,
          },
        } : null,
      }));
    } catch (error) {
      console.error('Failed to update photo interval:', error);
      throw error;
    }
  },

  generatePhotostrip: async (): Promise<string> => {
    const { session, selectedPhotos, currentTemplate } = get();
    
    if (!session) throw new Error('No active session');
    if (!currentTemplate) throw new Error('No template selected');
    if (selectedPhotos.length === 0) throw new Error('No photos selected');

    try {
      const hasTemplateSlots = (currentTemplate.photoSlots?.length || 0) >= selectedPhotos.length;
      const tw = (currentTemplate.dimensions?.width as any) || (1800 as any);
      const th = (currentTemplate.dimensions?.height as any) || (1200 as any);
      const response = await sessionService.generatePhotostrip(session.sessionId, {
        templateId: currentTemplate._id,
        selectedPhotoIds: selectedPhotos.map(p => p._id),
        targetWidth: tw,
        targetHeight: th,
        forceOrientation: th >= tw ? 'portrait' : 'landscape',
  customization: (hasTemplateSlots ? { autoLayout: false } : { autoLayout: true, padding: 24, borderRadius: 32 }) as any,
      } as any);

      set((state) => ({
        session: state.session ? {
          ...state.session,
          photostripPath: response.session.photostripPath,
          status: 'completed',
        } : null,
        stage: 'complete',
      }));

      return response.photostrip.url;
    } catch (error) {
      console.error('Failed to generate photostrip:', error);
      throw error;
    }
  },

  // Force landscape 1800x1200 regardless of template defaults
  generatePhotostripLandscape: async (): Promise<string> => {
    const { session, selectedPhotos, currentTemplate } = get();
    if (!session) throw new Error('No active session');
    if (!currentTemplate) throw new Error('No template selected');
    if (selectedPhotos.length === 0) throw new Error('No photos selected');
    const hasTemplateSlots = (currentTemplate.photoSlots?.length || 0) >= selectedPhotos.length;
    const response = await sessionService.generatePhotostrip(session.sessionId, {
      templateId: currentTemplate._id,
      selectedPhotoIds: selectedPhotos.map(p => p._id),
      targetWidth: 1800,
      targetHeight: 1200,
      forceOrientation: 'landscape',
  customization: (hasTemplateSlots ? { autoLayout: false } : { autoLayout: true, padding: 24, borderRadius: 32 }) as any,
    } as any);
    set((state) => ({
      session: state.session ? {
        ...state.session,
        photostripPath: response.session.photostripPath,
        status: 'completed',
      } : null,
      stage: 'complete',
    }));
    return response.photostrip.url;
  },

  // Force portrait 1200x1800 regardless of template defaults
  generatePhotostripPortrait: async (): Promise<string> => {
    const { session, selectedPhotos, currentTemplate } = get();
    if (!session) throw new Error('No active session');
    if (!currentTemplate) throw new Error('No template selected');
    if (selectedPhotos.length === 0) throw new Error('No photos selected');
    const hasTemplateSlots = (currentTemplate.photoSlots?.length || 0) >= selectedPhotos.length;
    const response = await sessionService.generatePhotostrip(session.sessionId, {
      templateId: currentTemplate._id,
      selectedPhotoIds: selectedPhotos.map(p => p._id),
      targetWidth: 1200,
      targetHeight: 1800,
      forceOrientation: 'portrait',
  customization: (hasTemplateSlots ? { autoLayout: false } : { autoLayout: true, padding: 24, borderRadius: 32 }) as any,
    } as any);
    set((state) => ({
      session: state.session ? {
        ...state.session,
        photostripPath: response.session.photostripPath,
        status: 'completed',
      } : null,
      stage: 'complete',
    }));
    return response.photostrip.url;
  },

  // 16-photo layout: Left 1x4, Right 2x6 on 1800x1200
  generatePhotostrip16: async (): Promise<string> => {
    const { session, selectedPhotos, currentTemplate } = get();
    if (!session) throw new Error('No active session');
    if (!currentTemplate) throw new Error('No template selected');
    if (selectedPhotos.length === 0) throw new Error('No photos selected');
    const photos = selectedPhotos.slice(0, 16); // cap to 16 to avoid fallback
    const response = await sessionService.generatePhotostrip(session.sessionId, {
      templateId: currentTemplate._id,
      selectedPhotoIds: photos.map(p => p._id),
      targetWidth: 1800,
      targetHeight: 1200,
      forceOrientation: 'landscape',
      layout: 'left1x4_right2x6',
      customization: { autoLayout: false, padding: 10 },
    } as any);
    set((state) => ({
      session: state.session ? {
        ...state.session,
        photostripPath: response.session.photostripPath,
        status: 'completed',
      } : null,
      stage: 'complete',
    }));
    return response.photostrip.url;
  },

  nextStage: () => {
    const { stage } = get();
    const stages: PhotoBoothState['stage'][] = ['intro', 'capture', 'review', 'template', 'generate', 'complete'];
    const currentIndex = stages.indexOf(stage);
    
    if (currentIndex < stages.length - 1) {
      set({ stage: stages[currentIndex + 1] });
    }
  },

  previousStage: () => {
    const { stage } = get();
    const stages: PhotoBoothState['stage'][] = ['intro', 'capture', 'review', 'template', 'generate', 'complete'];
    const currentIndex = stages.indexOf(stage);
    
    if (currentIndex > 0) {
      set({ stage: stages[currentIndex - 1] });
    }
  },

  setStage: (stage: PhotoBoothState['stage']) => {
    set({ stage });
  },

  resetSession: () => {
    set(initialState);
  },

  startCapturing: () => {
    set({ isCapturing: true });
  },

  stopCapturing: () => {
    set({ isCapturing: false });
  },

  setCurrentPhotoNumber: (number: number) => {
    set({ currentPhotoNumber: number });
  },
}));
