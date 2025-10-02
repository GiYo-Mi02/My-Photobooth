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
  const [isUpdatingInterval, setIsUpdatingInterval] = useState(false);
  const [showFlash, setShowFlash] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const countdownTimerRef = useRef<number | null>(null);
  const captureLockRef = useRef(false);

  const { 
    session,
    photos, 
    currentPhotoNumber, 
    uploadPhoto, 
    nextStage,
    isCapturing,
    startCapturing,
    stopCapturing,
    updatePhotoInterval,
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

  const MANUAL_COUNTDOWN_SECONDS = 5;
  const timerOptions = [5000, 10000, 15000];
  const autoIntervalMs = Math.max(session?.settings?.photoInterval ?? 15000, 1000);
  const autoCountdownSeconds = Math.max(1, Math.round(autoIntervalMs / 1000));

  const startCountdown = () => {
    if (photos.length >= 10) {
      nextStage();
      return;
    }
    if (isCapturing || captureLockRef.current) return;

    setIsCountingDown(true);
    setCountdown(MANUAL_COUNTDOWN_SECONDS);

    const timer = window.setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          window.clearInterval(timer);
          setIsCountingDown(false);
          capturePhoto();
          return MANUAL_COUNTDOWN_SECONDS;
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

  const clearAutoCountdown = () => {
    if (countdownTimerRef.current) {
      window.clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
  };

  const startAutoCountdown = () => {
    if (!isCapturingRef.current) return;
    const { photos: currentPhotos } = usePhotoBoothStore.getState();
    if (currentPhotos.length >= 10) {
      stopCapturing();
      nextStage();
      return;
    }

    clearAutoCountdown();
    setIsCountingDown(true);
    setCountdown(autoCountdownSeconds);

    let secondsRemaining = autoCountdownSeconds;
    countdownTimerRef.current = window.setInterval(() => {
      secondsRemaining -= 1;

      if (secondsRemaining <= 0) {
        clearAutoCountdown();
        setIsCountingDown(false);

        capturePhoto()
          .catch(() => {})
          .finally(() => {
            if (!isCapturingRef.current) return;
            const { photos: updatedPhotos } = usePhotoBoothStore.getState();
            if (updatedPhotos.length >= 10) {
              handleStopAuto();
              nextStage();
              return;
            }

            window.setTimeout(() => {
              if (isCapturingRef.current) {
                startAutoCountdown();
              }
            }, 250);
          });

        secondsRemaining = autoCountdownSeconds;
        return;
      }

      setCountdown(secondsRemaining);
    }, 1000);
  };

  const handleTimerChange = async (ms: number) => {
    if (!session) return;
    if (session.settings.photoInterval === ms) return;
    const wasCapturing = isCapturingRef.current;
    if (wasCapturing) {
      handleStopAuto();
    }
    setIsUpdatingInterval(true);
    try {
      await updatePhotoInterval(ms);
      toast.success(`Auto-capture set to ${Math.round(ms / 1000)} seconds`);
      clearAutoCountdown();
      if (wasCapturing && photos.length < 10) {
        window.setTimeout(() => {
          handleStartAuto();
        }, 200);
      }
    } catch (error) {
      console.error('Failed to update auto-capture interval:', error);
      toast.error('Failed to update timer');
    } finally {
      setIsUpdatingInterval(false);
    }
  };

  const handleStartAuto = () => {
    if (isCapturing || isCountingDown) return;
    if (captureLockRef.current) return;
    clearAutoCountdown();
    setIsCountingDown(false);
    isCapturingRef.current = true; // ensure immediate read reflects capturing
    startCapturing();
    startAutoCountdown();
  };

  const handleStopAuto = () => {
    stopCapturing();
    isCapturingRef.current = false;
    clearAutoCountdown();
    setIsCountingDown(false);
  };

  useEffect(() => {
    if (photos.length >= 10) {
      // ensure timers are stopped to prevent over-capture
      clearAutoCountdown();
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
      clearAutoCountdown();
      captureLockRef.current = false;
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
          <div className="flex flex-wrap items-center justify-center gap-2">
            <span className="font-medium text-gray-700">Auto Timer:</span>
            {timerOptions.map((option) => {
              const seconds = Math.round(option / 1000);
              const isActive = autoIntervalMs === option;
              return (
                <button
                  key={option}
                  onClick={() => handleTimerChange(option)}
                  disabled={isUpdatingInterval || captureLockRef.current}
                  className={`px-3 py-2 rounded-full border transition-colors ${
                    isActive
                      ? 'bg-primary-500 text-white border-primary-500 shadow'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
                  } ${isUpdatingInterval ? 'opacity-70 cursor-wait' : ''}`}
                >
                  {seconds}s
                </button>
              );
            })}
          </div>

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
                    Start {MANUAL_COUNTDOWN_SECONDS}s Timer
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
                  Auto-capture (every {autoCountdownSeconds}s)
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
