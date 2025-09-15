import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import Webcam from 'react-webcam';
import { FiCamera, FiPlay, FiPause, FiStopCircle } from 'react-icons/fi';
import { usePhotoBoothStore } from '../../stores/photoBoothStore';
import toast from 'react-hot-toast';
import { apiClient } from '../../lib/api';

const CaptureStage = () => {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  // Auto mode toggles: kiosk=1 or auto=1 in query will auto-start the loop
  const autoMode = params.get('kiosk') === '1' || params.get('auto') === '1';

  const webcamRef = useRef<Webcam>(null);
  const [isCountingDown, setIsCountingDown] = useState(false);
  const [countdown, setCountdown] = useState(5);
  const [showFlash, setShowFlash] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const countdownTimerRef = useRef<number | null>(null);
  const loopTimerRef = useRef<number | null>(null);
  const captureLockRef = useRef(false);

  const { 
    photos, 
    currentPhotoNumber, 
    uploadPhoto, 
    nextStage,
    isCapturing,
    startCapturing,
    stopCapturing
  } = usePhotoBoothStore();

  // Initialize with a static value to avoid TDZ when React evaluates hooks
  const isCapturingRef = useRef(false);

  useEffect(() => {
    isCapturingRef.current = isCapturing;
  }, [isCapturing]);

  const capturePhoto = async () => {
    if (captureLockRef.current) return;
    if (!webcamRef.current) return;
    if (photos.length >= 10) return;

    try {
      captureLockRef.current = true;
      setShowFlash(true);
      const imageSrc = webcamRef.current.getScreenshot();
      
      if (imageSrc) {
        await uploadPhoto(currentPhotoNumber, imageSrc);
        toast.success(`Photo ${currentPhotoNumber} captured!`);
      }

      setTimeout(() => setShowFlash(false), 300);
    } catch (error) {
      console.error('Failed to capture photo:', error);
      toast.error('Failed to capture photo');
    }
    finally {
      // small delay to avoid immediate double-fire from rapid events
      window.setTimeout(() => { captureLockRef.current = false; }, 200);
    }
  };

  const startCountdown = () => {
    if (photos.length >= 10) {
      nextStage();
      return;
    }
    if (isCapturing || captureLockRef.current) return;

    setIsCountingDown(true);
    setCountdown(5);

    const timer = window.setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          window.clearInterval(timer);
          setIsCountingDown(false);
          capturePhoto();
          return 5;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleManualCapture = () => {
    if (isCountingDown) return;
    if (captureLockRef.current) return;
    if (photos.length >= 10) return;
    capturePhoto();
  };

  // Auto-capture loop controller
  const queueNextAutoCapture = () => {
    if (!isCapturingRef.current) return;
    const { photos: currentPhotos } = usePhotoBoothStore.getState();
    if (currentPhotos.length >= 10) {
      stopCapturing();
      nextStage();
      return;
    }
    // Start a countdown and after capture, schedule the next run
    setIsCountingDown(true);
    setCountdown(5);
    // Clear any existing countdown interval
    if (countdownTimerRef.current) {
      window.clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    const intervalId = window.setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          window.clearInterval(intervalId);
          countdownTimerRef.current = null;
          setIsCountingDown(false);
          capturePhoto().finally(() => {
            // Wait a short moment before queuing next countdown to allow state to update
            if (loopTimerRef.current) {
              window.clearTimeout(loopTimerRef.current);
              loopTimerRef.current = null;
            }
            loopTimerRef.current = window.setTimeout(() => {
              queueNextAutoCapture();
            }, 250);
          });
          return 5;
        }
        return prev - 1;
      });
    }, 1000);
    countdownTimerRef.current = intervalId;
  };

  const handleStartAuto = () => {
    if (isCapturing || isCountingDown) return;
    if (captureLockRef.current) return;
    // Clear any stale timers/flags before starting
    if (countdownTimerRef.current) {
      window.clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    if (loopTimerRef.current) {
      window.clearTimeout(loopTimerRef.current);
      loopTimerRef.current = null;
    }
    setIsCountingDown(false);
    isCapturingRef.current = true; // ensure immediate read reflects capturing
    startCapturing();
    // kick off on next task to avoid same-tick stale reads
    window.setTimeout(() => queueNextAutoCapture(), 0);
  };

  const handleStopAuto = () => {
    stopCapturing();
    isCapturingRef.current = false;
    if (countdownTimerRef.current) window.clearInterval(countdownTimerRef.current);
    if (loopTimerRef.current) window.clearTimeout(loopTimerRef.current);
    setIsCountingDown(false);
  };

  useEffect(() => {
    if (photos.length >= 10) {
      // ensure timers are stopped to prevent over-capture
      if (countdownTimerRef.current) {
        window.clearInterval(countdownTimerRef.current);
        countdownTimerRef.current = null;
      }
      if (loopTimerRef.current) {
        window.clearTimeout(loopTimerRef.current);
        loopTimerRef.current = null;
      }
      setIsCountingDown(false);
      stopCapturing();
      setTimeout(() => {
        nextStage();
      }, 600);
    }
  }, [photos.length, nextStage, stopCapturing]);

  useEffect(() => {
    // Cleanup timers on unmount
    return () => {
      if (countdownTimerRef.current) {
        window.clearInterval(countdownTimerRef.current);
        countdownTimerRef.current = null;
      }
      if (loopTimerRef.current) {
        window.clearTimeout(loopTimerRef.current);
        loopTimerRef.current = null;
      }
    };
  }, []);

  // Auto-start in kiosk/auto mode once the camera stream is ready
  useEffect(() => {
    if (!autoMode) return;
    if (!cameraReady) return;
    if (isCapturingRef.current) return;
    if (photos.length >= 10) return;
    handleStartAuto();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoMode, cameraReady, photos.length]);

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
            Photo {currentPhotoNumber} of 10
          </h1>
          <div className="flex justify-center space-x-2 mb-4">
            {Array.from({ length: 10 }, (_, i) => (
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
        <div className="relative bg-black rounded-lg overflow-hidden shadow-2xl mb-6">
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

          <Webcam
            ref={webcamRef}
            audio={false}
            screenshotFormat="image/jpeg"
            screenshotQuality={0.92}
            videoConstraints={{
              width: 640,
              height: 480,
              facingMode: 'user'
            }}
            onUserMedia={() => setCameraReady(true)}
            onUserMediaError={() => setCameraReady(false)}
            className="w-full h-auto"
          />
        </div>

        {/* Controls */}
        <div className="flex flex-col sm:flex-row justify-center space-y-4 sm:space-y-0 sm:space-x-4">
          {photos.length < 10 && (
            <>
              <button
                onClick={startCountdown}
                disabled={isCountingDown || isCapturing || captureLockRef.current}
                className="btn-primary inline-flex items-center justify-center"
              >
                {isCountingDown ? (
                  <>
                    <FiPause className="mr-2 h-5 w-5" />
                    Capturing in {countdown}...
                  </>
                ) : (
                  <>
                    <FiPlay className="mr-2 h-5 w-5" />
                    Start 5s Timer
                  </>
                )}
              </button>

              <button
                onClick={handleManualCapture}
                disabled={isCountingDown || isCapturing || captureLockRef.current}
                className="btn-secondary inline-flex items-center justify-center"
              >
                <FiCamera className="mr-2 h-5 w-5" />
                Capture Now
              </button>

              {!isCapturing ? (
                <button
                  onClick={handleStartAuto}
                  disabled={isCountingDown || captureLockRef.current}
                  className="btn-ghost inline-flex items-center justify-center"
                >
                  <FiPlay className="mr-2 h-5 w-5" />
                  Auto-capture (every 5s)
                </button>
              ) : (
                <button
                  onClick={handleStopAuto}
                  className="btn-ghost inline-flex items-center justify-center"
                >
                  <FiStopCircle className="mr-2 h-5 w-5" />
                  Stop Auto-capture
                </button>
              )}
            </>
          )}

          {photos.length >= 3 && (
            <button
              onClick={nextStage}
              className="btn-ghost"
            >
              Continue to Review ({photos.length} photos)
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
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default CaptureStage;
