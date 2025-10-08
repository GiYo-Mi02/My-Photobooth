import { useEffect, useRef, useMemo } from 'react';
import Webcam from 'react-webcam';
import { useWebcamStore } from '../../stores/webcamStore';

// A hidden (or positioned) persistent webcam that survives stage changes
// CaptureStage will request screenshots via webcamStore.

const PersistentWebcam: React.FC = () => {
  const ref = useRef<Webcam>(null);
  const { register, setReady } = useWebcamStore();

  const constraints = useMemo(() => ({
    width: 1980,
    height: 1080,
    facingMode: 'user'
  }), []);

  useEffect(() => {
    console.log('[PersistentWebcam] mount');
    register(ref.current);
    return () => {
      console.log('[PersistentWebcam] unmount');
      register(null);
    };
  }, [register]);

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}>
      <Webcam
        ref={ref}
        audio={false}
        screenshotFormat="image/jpeg"
        screenshotQuality={0.92}
        videoConstraints={constraints}
        onUserMedia={() => { setReady(true); }}
        onUserMediaError={() => { setReady(false); }}
      />
    </div>
  );
};

export default PersistentWebcam;
