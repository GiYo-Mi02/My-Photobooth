import { useState, useEffect, useRef } from 'react';
// Access underlying video element from persistent webcam via DOM query (react-webcam creates a video tag)
const getVideoEl = () => document.querySelector<HTMLVideoElement>('video');
import { motion } from 'framer-motion';
import { FiCamera } from 'react-icons/fi';
import { usePhotoBoothStore } from '../../stores/photoBoothStore';
import toast from 'react-hot-toast';
import { apiClient } from '../../lib/api';
import { useWebcamStore } from '../../stores/webcamStore';
// formatBytes removed (unused) – can re-import if showing size metrics later

const CaptureStage = () => {
  // Global diagnostic counters (attached to window for inspection)
  const w = window as any;
  w.__capMounts = (w.__capMounts || 0) + 1;
  if (w.__capMounts % 5 === 1) {
    console.log('[Diag] CaptureStage mount count:', w.__capMounts);
  }

  // Persistent webcam handled globally (PersistentWebcam component). We access it via the webcam store.
  const { ready: cameraReady, reliableCapture, capturing, lastCaptureAt, lastResult } = useWebcamStore();
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const previewAnimRef = useRef<number | null>(null);
  const [isCountingDown, setIsCountingDown] = useState(false);
  const [countdown, setCountdown] = useState(5);
  const [selectedTimer, setSelectedTimer] = useState(5);
  const [showFlash, setShowFlash] = useState(false);
  const timerRef = useRef<number | null>(null);
  const captureLockRef = useRef(false);
  // Store-driven auto capture persistence
  const { autoCapture, startAutoCapture, stopAutoCapture, setAutoCountdown, setAutoInFlight } = usePhotoBoothStore();
  const autoTickTimerRef = useRef<number | null>(null);

  const { 
    session,
    photos, 
    currentPhotoNumber, 
    uploadPhoto, 
    nextStage,
    createSession,
  } = usePhotoBoothStore();

  const maxPhotos = Math.max(1, session?.settings?.maxPhotos ?? 10);

  // (Removed) videoConstraints now owned by PersistentWebcam.

  useEffect(() => {
    console.log('[Photobooth] CaptureStage mounted');
    // Live preview animation loop drawing the persistent webcam video into local canvas
    const animate = () => {
      const canvas = previewCanvasRef.current;
      const video = getVideoEl();
      if (canvas && video && video.readyState >= 2) { // HAVE_CURRENT_DATA
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const vw = video.videoWidth;
          const vh = video.videoHeight;
            if (vw && vh) {
              const cw = canvas.width = canvas.clientWidth;
              const ch = canvas.height = canvas.clientHeight;
              const vr = vw / vh;
              const cr = cw / ch;
              let dw = cw, dh = ch, dx = 0, dy = 0;
              if (vr > cr) { // video wider – scale by height
                dw = ch * vr;
                dx = (cw - dw) / 2;
              } else { // video taller – scale by width
                dh = cw / vr;
                dy = (ch - dh) / 2;
              }
              ctx.drawImage(video, dx, dy, dw, dh);
            }
        }
      }
      previewAnimRef.current = requestAnimationFrame(animate);
    };
    previewAnimRef.current = requestAnimationFrame(animate);
    return () => {
      console.log('[Photobooth] CaptureStage unmounting');
      const w = window as any;
      w.__capUnmounts = (w.__capUnmounts || 0) + 1;
      if (w.__capUnmounts % 5 === 1) {
        console.log('[Diag] CaptureStage unmount count:', w.__capUnmounts);
      }
      if (previewAnimRef.current) cancelAnimationFrame(previewAnimRef.current);
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (autoTickTimerRef.current) clearTimeout(autoTickTimerRef.current);
    };
  }, []);

 const capturePhoto = async () => {
  if (captureLockRef.current || autoCapture.inFlight) return;
  if (photos.length >= maxPhotos) return;

  // Ensure a session exists (defensive)
  if (!session) {
    console.warn('[Photobooth] No active session – creating one before capture');
    try {
      await createSession();
    } catch (e) {
      console.error('[Photobooth] Failed to auto-create session', e);
      return;
    }
  }

  // Wait briefly for camera readiness (up to 1.5s)
  let readinessWaits = 0;
  while (!cameraReady && readinessWaits < 10) {
    await new Promise(r => setTimeout(r, 150));
    readinessWaits++;
  }
  if (!cameraReady) {
    console.warn('[Photobooth] Capture skipped: camera not ready after retries');
    return;
  }

  try {
    captureLockRef.current = true;
    setAutoInFlight(true);
    setShowFlash(true);
    const dataUrl = await reliableCapture();
    if (dataUrl) {
      await uploadPhoto(currentPhotoNumber, dataUrl);
      toast.success(`Photo ${currentPhotoNumber} captured!`);
    } else {
      console.warn('[Photobooth] reliableCapture returned null', lastResult);
      toast.error('Capture failed');
      // Single scheduled retry
      setTimeout(() => { if (!captureLockRef.current) capturePhoto(); }, 900);
    }
    setTimeout(() => setShowFlash(false), 240);
  } catch (error) {
    console.error('[Photobooth] Failed to capture photo:', error);
    toast.error('Failed to capture photo');
  } finally {
    setTimeout(() => {
      captureLockRef.current = false;
      setAutoInFlight(false);
    }, 400);
  }
};

  const startTimer = (seconds: number) => {
    if (captureLockRef.current) return;
    if (isCountingDown) return;
    if (photos.length >= maxPhotos) {
      nextStage();
      return;
    }
    
    if (!cameraReady) {
      toast.error('Camera not ready. Please wait for camera to initialize.');
      return;
    }

    console.log('[Photobooth] Starting timer:', seconds, 'seconds');
    setIsCountingDown(true);
    setCountdown(seconds);

    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    timerRef.current = window.setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          timerRef.current = null;
          setIsCountingDown(false);
          console.log('[Photobooth] Timer complete, capturing photo');
          capturePhoto();
          return seconds;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleInstantCapture = () => {
    if (isCountingDown) return;
    if (captureLockRef.current) return;
    if (photos.length >= maxPhotos) return;
    capturePhoto();
  };

  const cancelTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsCountingDown(false);
    
    if (autoCapture.active) stopAutoCapture();
  };

  useEffect(() => {
    if (photos.length >= maxPhotos) {
      cancelTimer();
      stopAutoCapture();
      setTimeout(() => {
        nextStage();
      }, 600);
    }
  }, [maxPhotos, nextStage, photos.length]);

  // Store-driven auto capture effect (gated by camera readiness)
  useEffect(() => {
    if (!autoCapture.active) {
      if (autoTickTimerRef.current) {
        clearTimeout(autoTickTimerRef.current);
        autoTickTimerRef.current = null;
      }
      return;
    }
    // Mirror store countdown into local overlay state
    setIsCountingDown(true);
    setCountdown(autoCapture.countdown);
    // If camera not ready yet, hold countdown (avoid burning interval time)
    if (!cameraReady) {
      // Poll quickly until ready
      autoTickTimerRef.current = window.setTimeout(() => {
        setAutoCountdown(autoCapture.countdown); // keep same value
      }, 300);
      return () => { if (autoTickTimerRef.current) clearTimeout(autoTickTimerRef.current); };
    }

    // Stabilization delay: ensure camera has been ready at least 400ms
    const stableStart = performance.now();
    const ensureStable = async () => {
      while (performance.now() - stableStart < 400) {
        await new Promise(r => setTimeout(r, 80));
        if (!cameraReady) return false; // aborted
      }
      return true;
    };

    if (autoCapture.countdown <= 0) {
      (async () => {
        const stable = await ensureStable();
        if (!stable) {
          setAutoCountdown(1); // retry soon
          return;
        }
        if (!autoCapture.inFlight && !captureLockRef.current) {
          console.log('[Photobooth] Auto countdown hit 0 – capture attempt');
          await capturePhoto();
          await new Promise(r => setTimeout(r, 450));
          const current = usePhotoBoothStore.getState().photos.length;
          if (current >= maxPhotos) {
            stopAutoCapture();
            setTimeout(() => nextStage(), 600);
            return;
          }
          setAutoCountdown(autoCapture.interval);
        } else {
          setAutoCountdown(1); // something still in progress, retry shortly
        }
      })();
      return;
    }

    autoTickTimerRef.current = window.setTimeout(() => {
      if (!cameraReady) {
        setAutoCountdown(autoCapture.countdown); // freeze while not ready
      } else {
        setAutoCountdown(autoCapture.countdown - 1);
      }
    }, 1000);
    return () => {
      if (autoTickTimerRef.current) clearTimeout(autoTickTimerRef.current);
    };
  }, [autoCapture.active, autoCapture.countdown, autoCapture.interval, autoCapture.inFlight, cameraReady, maxPhotos, nextStage, setAutoCountdown, stopAutoCapture]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-4xl"
      >
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Photo {Math.min(currentPhotoNumber, maxPhotos)} of {maxPhotos}
          </h1>
          <div className="flex justify-center space-x-2 mb-4">
            {Array.from({ length: maxPhotos }, (_, i) => (
              <div
                key={i}
                className={`w-3 h-3 rounded-full ${
                  i < photos.length 
                    ? 'bg-green-500' 
                    : i === currentPhotoNumber - 1 
                    ? 'bg-primary-500' 
                    : 'bg-gray-300'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Camera Section */}
  <div className="relative bg-black rounded-lg overflow-hidden shadow-2xl mb-6 w-full max-w-2xl aspect-[4/3] flex items-center justify-center mx-auto">
    {showFlash && (
      <div className="absolute inset-0 bg-white z-20 flash-animation" />
    )}
    
    {isCountingDown && (
      <div className="absolute inset-0 flex items-center justify-center z-10 bg-black/50">
        <motion.div
    key={countdown}
    initial={{ scale: 0 }}
    animate={{ scale: 1 }}
    exit={{ scale: 0 }}
    className="countdown-number"
        >
    {countdown}
        </motion.div>
      </div>
    )}

    <canvas ref={previewCanvasRef} className="absolute inset-0 w-full h-full object-cover" />
    {!cameraReady && (
      <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-white/80 text-sm">Initializing camera...</div>
    )}
    <div className="absolute top-2 left-2 flex flex-col gap-1 z-30">
      <span className={`px-2 py-1 rounded text-xs font-semibold ${cameraReady ? 'bg-emerald-600/80 text-white' : 'bg-yellow-600/80 text-white'}`}>{cameraReady ? 'Ready' : 'Init'}</span>
      {capturing && <span className="px-2 py-1 rounded text-xs bg-blue-600/80 text-white animate-pulse">Capturing</span>}
      {lastResult && !lastResult.success && <span className="px-2 py-1 rounded text-xs bg-red-600/80 text-white">Retrying…</span>}
    </div>
    {autoCapture.active && (
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
        <div className="h-full bg-primary-400 transition-all" style={{ width: `${(autoCapture.countdown / autoCapture.interval) * 100}%` }} />
      </div>
    )}
  </div>

        {/* Controls */}
        <div className="flex flex-col items-center space-y-4">
          {photos.length < maxPhotos && (
            <>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <span className="font-medium text-gray-700">Manual Timer: </span>
                {[5, 10, 15].map((seconds) => (
                  <button
                    key={seconds}
                    onClick={() => {
                      setSelectedTimer(seconds);
                      startTimer(seconds);
                    }}
                    disabled={isCountingDown || captureLockRef.current}
                    className={`px-4 py-2 rounded-full border transition-colors ${
                      selectedTimer === seconds && !isCountingDown
                        ? 'bg-primary-500 text-white border-primary-500 shadow'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
                    } ${isCountingDown || captureLockRef.current ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {seconds}s
                  </button>
                ))}

                <div className="flex items-center gap-2">
                  {!autoCapture.active ? (
                    <button
                      onClick={() => startAutoCapture(selectedTimer)}
                      disabled={captureLockRef.current}
                      className="px-5 py-2 rounded-full bg-blue-600 text-white hover:bg-blue-700 transition whitespace-nowrap"
                    >
                      Auto ({selectedTimer}s)
                    </button>
                  ) : (
                    <button
                      onClick={stopAutoCapture}
                      className="px-5 py-2 rounded-full bg-red-600 text-white hover:bg-red-700 transition"
                    >
                      Stop Auto
                    </button>
                  )}
                  {autoCapture.active && (
                    <div className="flex items-center gap-1 text-xs text-gray-600">
                      <span className="px-2 py-1 bg-gray-200 rounded-full">Interval {autoCapture.interval}s</span>
                      <span className="px-2 py-1 bg-gray-200 rounded-full">T-{autoCapture.countdown}s</span>
                      {autoCapture.inFlight && <span className="px-2 py-1 bg-blue-200 text-blue-700 rounded-full">Uploading…</span>}
                    </div>
                  )}
                </div>
                
                {isCountingDown && (
                  <button
                    onClick={cancelTimer}
                    className="px-4 py-2 rounded-full bg-red-500 text-white hover:bg-red-600 transition-colors"
                  >
                    Cancel
                  </button>
                )}
              </div>

              <button
                onClick={handleInstantCapture}
                disabled={isCountingDown || captureLockRef.current || capturing}
                className="btn-primary inline-flex items-center justify-center disabled:opacity-60"
              >
                <FiCamera className="mr-2 h-5 w-5" />
                {capturing ? 'Capturing...' : 'Capture Now'}
              </button>
            </>
          )}

          {photos.length >= 3 && (
            <button
              onClick={nextStage}
              className="btn-ghost"
            >
              Continue to Review ({photos.length} / {maxPhotos})
            </button>
          )}
        </div>

        {/* Photo Thumbnails */}
        {photos.length > 0 && (
          <div className="mt-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 text-center">
              Captured Photos
            </h3>
            <div className="grid grid-cols-5 gap-2 max-w-2xl mx-auto">
              {photos.map((photo) => (
                <div key={photo._id} className="aspect-square">
                  <img
                    src={apiClient.getFileUrl(photo.path)}
                    alt={`Photo ${photo.photoNumber}`}
                    className="w-full h-full object-cover rounded border-2 border-green-400"
                  />
                </div>
              ))}
            </div>
            <div className="mt-4 text-center text-xs text-gray-500">
              {lastResult && (
                <span>
                  Last: {lastResult.success ? 'OK' : 'Fail'} • attempts {lastResult.attempts} • {lastResult.durationMs.toFixed(0)}ms{lastResult.reason ? ` • ${lastResult.reason}` : ''}{lastCaptureAt ? ` • ${new Date(lastCaptureAt).toLocaleTimeString()}` : ''}
                </span>
              )}
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default CaptureStage;
