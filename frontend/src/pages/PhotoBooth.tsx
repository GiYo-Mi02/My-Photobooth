import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { usePhotoBoothStore } from '../stores/photoBoothStore';
import IntroStage from '../components/photobooth/IntroStage';
import CaptureStage from '../components/photobooth/CaptureStage';
import ReviewStage from '../components/photobooth/ReviewStage';
import TemplateStage from '../components/photobooth/TemplateStage';
import GenerateStage from '../components/photobooth/GenerateStage';
import CompleteStage from '../components/photobooth/CompleteStage';

const PhotoBooth = () => {
  const { stage, resetSession, createSession } = usePhotoBoothStore();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const kiosk = params.get('kiosk') === '1';

  // Simple Error Boundary
  const [error, setError] = useState<Error | null>(null);
  const ErrorBoundary: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    try {
      if (error) throw error;
      return <>{children}</>;
    } catch (e) {
      const err = e as Error;
      return (
        <div className="min-h-[60vh] flex flex-col items-center justify-center text-center">
          <h2 className="text-2xl font-semibold text-red-600 mb-2">Something went wrong</h2>
          <p className="text-gray-600 mb-6">{err.message || 'An unexpected error occurred while loading the photobooth.'}</p>
          <button className="btn-primary" onClick={() => { setError(null); resetSession(); }}>
            Back to Start
          </button>
        </div>
      );
    }
  };

  useEffect(() => {
    // Ensure a clean session when opening the Photobooth page
    resetSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!kiosk) return;
    if (stage === 'intro') {
      // Try to enter fullscreen for kiosk
      const el = document.documentElement as any;
      if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
      // Auto-start a session
      createSession().catch(() => {});
    }
  }, [kiosk, stage, createSession]);

  const renderStage = () => {
    switch (stage) {
      case 'intro':
        return <IntroStage />;
      case 'capture':
        return <CaptureStage />;
      case 'review':
        return <ReviewStage />;
      case 'template':
        return <TemplateStage />;
      case 'generate':
        return <GenerateStage />;
      case 'complete':
        return <CompleteStage />;
      default:
        return <IntroStage />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100">
      <div className="container mx-auto px-4 py-8">
        <ErrorBoundary>
          {renderStage()}
        </ErrorBoundary>
      </div>
    </div>
  );
};

export default PhotoBooth;
