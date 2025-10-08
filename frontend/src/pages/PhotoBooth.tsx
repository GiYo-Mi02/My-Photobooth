import { useEffect, useState, useRef, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { usePhotoBoothStore } from '../stores/photoBoothStore';
import IntroStage from '../components/photobooth/IntroStage';
import CaptureStage from '../components/photobooth/CaptureStage';
import ReviewStage from '../components/photobooth/ReviewStage';
import TemplateStage from '../components/photobooth/TemplateStage';
import GenerateStage from '../components/photobooth/GenerateStage';
import CompleteStage from '../components/photobooth/CompleteStage';
import PersistentWebcam from '../components/photobooth/PersistentWebcam';

// Stable error boundary component (avoids redefining per render)
interface SimpleBoundaryProps { error: Error | null; onReset: () => void; children: React.ReactNode; }
const SimpleBoundary: React.FC<SimpleBoundaryProps> = ({ error, onReset, children }) => {
  if (error) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center">
        <h2 className="text-2xl font-semibold text-red-600 mb-2">Something went wrong</h2>
        <p className="text-gray-600 mb-6">{error.message || 'An unexpected error occurred while loading the photobooth.'}</p>
        <button className="btn-primary" onClick={onReset}>Back to Start</button>
      </div>
    );
  }
  return <>{children}</>;
};

const PhotoBooth = () => {
  const { stage, resetSession, createSession } = usePhotoBoothStore();
  const renderCountRef = useRef(0);
  renderCountRef.current += 1;
  if (renderCountRef.current % 10 === 1) {
    // Throttle log volume
    console.log('[PhotoBooth] Render count:', renderCountRef.current, 'stage:', stage);
  }
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const kiosk = params.get('kiosk') === '1';

  const [error, setError] = useState<Error | null>(null);

  const didInitRef = useRef(false);
  useEffect(() => {
    if (didInitRef.current) return;
    didInitRef.current = true;
    console.log('[PhotoBooth] Initial mount (one-time), resetting session');
    resetSession();
    // Track a marker to detect unintended subsequent resets
    (window as any).__pbInitTime = Date.now();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    console.log('[PhotoBooth] Stage changed ->', stage, 'at', new Date().toISOString());
    // Detect if stage oscillates back to intro unexpectedly
    if ((window as any).__lastStages) {
      (window as any).__lastStages.push({ stage, ts: performance.now() });
      if ((window as any).__lastStages.length > 40) (window as any).__lastStages.shift();
    } else {
      (window as any).__lastStages = [{ stage, ts: performance.now() }];
    }
  }, [stage]);

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

  const stageElement = useMemo(() => {
    const el = (() => {
      switch (stage) {
        case 'intro': return <IntroStage />;
        case 'capture': return <CaptureStage />;
        case 'review': return <ReviewStage />;
        case 'template': return <TemplateStage />;
        case 'generate': return <GenerateStage />;
        case 'complete': return <CompleteStage />;
        default: return <IntroStage />;
      }
    })();
    console.log('[Diag] stageElement memo created for stage', stage);
    return el;
  }, [stage]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 relative">
      {/* Persistent hidden webcam (mounted once) */}
      <PersistentWebcam />
      <div className="container mx-auto px-4 py-8">
        <SimpleBoundary error={error} onReset={() => { setError(null); resetSession(); }}>
          {stageElement}
        </SimpleBoundary>
      </div>
    </div>
  );
};

export default PhotoBooth;
