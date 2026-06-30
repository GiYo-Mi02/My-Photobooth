import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import { FiDownload, FiRefreshCw, FiPrinter } from 'react-icons/fi';
import { usePhotoBoothStore } from '../../stores/photoBoothStore';
import { apiClient } from '../../lib/api';
import toast from 'react-hot-toast';
import SharePanel from '../SharePanel';
import LivePhotoCard from './LivePhotoCard';
import LivePhotostrip from './LivePhotostrip';

const CompleteStage = () => {
  const { 
    resetSession, 
    session, 
    photos, 
    currentTemplate, 
    selectedPhotos, 
    regeneratePhotostripWithPhotoFilter 
  } = usePhotoBoothStore();
  const [showFinal, setShowFinal] =  useState(false);
  const [activeFilter, setActiveFilter] = useState<'none' | 'monochrome' | 'rio'>('none');
  const [isApplyingFilter, setIsApplyingFilter] = useState(false);
  const [activeTab, setActiveTab] = useState<'live' | 'static' | 'gif'>(
    (currentTemplate && selectedPhotos.length > 0) ? 'live' : 'static'
  );
  const [isCompilingLiveVideo, setIsCompilingLiveVideo] = useState(false);
  const [liveVideoUrl, setLiveVideoUrl] = useState<string | null>(
    (session?.metadata as any)?.livePhotostripUrl || null
  );

  const previewPath = (showFinal && session?.finalCompositePath)
    ? session.finalCompositePath
    : session?.photostripPath;

  const shareCandidate =
    session?.sharePath ||
    session?.metadata?.cloudinaryPhotostripPath ||
    previewPath;

  const shareUrl = shareCandidate
    ? (/^https?:\/\//i.test(shareCandidate) ? shareCandidate : apiClient.getFileUrl(shareCandidate))
    : '';

  const handleNewSession = () => {
    resetSession();
  };

  const applyPhotoFilter = async (filter: 'none' | 'monochrome' | 'rio') => {
    try {
      setIsApplyingFilter(true);
      await regeneratePhotostripWithPhotoFilter(filter);
      setActiveFilter(filter);
      const label = filter === 'none' ? 'Original colors restored' : filter === 'monochrome' ? 'Monochrome filter applied' : 'Rio de Janeiro filter applied';
      toast.success(label);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to apply filter');
    } finally {
      setIsApplyingFilter(false);
    }
  };

  const compileLiveVideo = async () => {
    if (!currentTemplate || !selectedPhotos.length || !session) return;
    
    try {
      setIsCompilingLiveVideo(true);
      toast.loading('Compiling live photostrip video...', { id: 'compile-video' });

      const tWidth = currentTemplate.dimensions.width;
      const tHeight = currentTemplate.dimensions.height;

      // Create a canvas
      const canvas = document.createElement('canvas');
      canvas.width = tWidth;
      canvas.height = tHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Could not get 2D context');

      // Load template background image
      const templateImg = new Image();
      templateImg.crossOrigin = 'anonymous';
      const baseUrl = 'http://localhost:5000';
      const getUrl = (pathStr?: string) => {
        if (!pathStr) return '';
        return /^https?:\/\//i.test(pathStr) ? pathStr : `${baseUrl}${pathStr}`;
      };
      templateImg.src = getUrl(currentTemplate.path);
      await new Promise((resolve, reject) => {
        templateImg.onload = resolve;
        templateImg.onerror = () => reject(new Error('Failed to load template image'));
      });

      // Find the video elements in the DOM
      const videoElements: HTMLVideoElement[] = [];
      for (let i = 0; i < currentTemplate.photoSlots.length; i++) {
        const videoEl = document.getElementById(`strip-video-${i}`) as HTMLVideoElement | null;
        if (videoEl) {
          videoElements.push(videoEl);
        }
      }

      // Check if we found all videos
      if (videoElements.length === 0) {
        throw new Error('Please open the "Live Strip" tab first so the videos are loaded on screen!');
      }

      // Define template over photos boolean
      const templateOverPhotos = (currentTemplate.metadata as any)?.templateOverPhotos === true;

      // Draw loop at 30 fps (approx. 33ms) - setInterval bypasses browser tab inactivity throttling
      const drawInterval = setInterval(() => {
        // Clear canvas
        ctx.clearRect(0, 0, tWidth, tHeight);

        // If template is background
        if (!templateOverPhotos) {
          ctx.drawImage(templateImg, 0, 0, tWidth, tHeight);
        }

        // Draw videos in slots
        currentTemplate.photoSlots.forEach((slot, index) => {
          const mediaEl = (document.getElementById(`strip-video-${index}`) || document.getElementById(`strip-img-${index}`)) as HTMLVideoElement | HTMLImageElement | null;
          if (mediaEl) {
            const isVideo = mediaEl instanceof HTMLVideoElement;
            const ready = isVideo ? (mediaEl as HTMLVideoElement).readyState >= 2 : (mediaEl as HTMLImageElement).complete;
            if (ready) {
              ctx.save();
              
              // Apply positioning and rotation
              const centerX = slot.x + slot.width / 2;
              const centerY = slot.y + slot.height / 2;
              ctx.translate(centerX, centerY);
              if (slot.rotation) {
                ctx.rotate((slot.rotation * Math.PI) / 180);
              }
              
              // Calculate object-fit: cover crop bounds to prevent stretching
              const mediaWidth = isVideo ? (mediaEl as HTMLVideoElement).videoWidth : (mediaEl as HTMLImageElement).naturalWidth;
              const mediaHeight = isVideo ? (mediaEl as HTMLVideoElement).videoHeight : (mediaEl as HTMLImageElement).naturalHeight;
              
              if (mediaWidth && mediaHeight) {
                const mediaAspectRatio = mediaWidth / mediaHeight;
                const slotAspectRatio = slot.width / slot.height;
                
                let sx = 0, sy = 0, sw = mediaWidth, sh = mediaHeight;
                
                if (mediaAspectRatio > slotAspectRatio) {
                  sw = mediaHeight * slotAspectRatio;
                  sx = (mediaWidth - sw) / 2;
                } else {
                  sh = mediaWidth / slotAspectRatio;
                  sy = (mediaHeight - sh) / 2;
                }
                
                ctx.drawImage(
                  mediaEl,
                  sx, sy, sw, sh,
                  -slot.width / 2, -slot.height / 2, slot.width, slot.height
                );
              } else {
                ctx.drawImage(mediaEl, -slot.width / 2, -slot.height / 2, slot.width, slot.height);
              }
              
              ctx.restore();
            }
          }
        });

        // If template is overlay
        if (templateOverPhotos) {
          ctx.drawImage(templateImg, 0, 0, tWidth, tHeight);
        }
      }, 33);

      // Start recording the canvas at 30 fps
      const stream = canvas.captureStream(30);
      
      // Determine supported mimeTypes and specify a high bitrate constraint
      let options: any = { 
        mimeType: 'video/webm;codecs=vp9',
        videoBitsPerSecond: 10000000
      };
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options = { 
          mimeType: 'video/webm',
          videoBitsPerSecond: 10000000
        };
      }
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options = { 
          mimeType: 'video/mp4',
          videoBitsPerSecond: 10000000
        };
      }

      const chunks: Blob[] = [];
      const mediaRecorder = new MediaRecorder(stream, options);

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      // Set up the stop promise before stopping the recorder to prevent race conditions
      const videoBlobPromise = new Promise<Blob>((resolve) => {
        mediaRecorder.onstop = () => {
          const blob = new Blob(chunks, { type: options.mimeType.split(';')[0] });
          resolve(blob);
        };
      });

      // Start recording
      mediaRecorder.start();

      // Record for exactly 6 seconds
      await new Promise((resolve) => setTimeout(resolve, 6000));

      // Stop recording and clear draw loop
      mediaRecorder.stop();
      clearInterval(drawInterval);

      // Await compiled video data from listener
      const videoBlob = await videoBlobPromise;

      // Upload the compiled video blob to backend
      const formData = new FormData();
      formData.append('livePhotostrip', videoBlob, `live-photostrip-${session.sessionId}.webm`);

      const uploadUrl = `http://localhost:5000/api/sessions/${session.sessionId}/upload-live-photostrip`;
      const response = await fetch(uploadUrl, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to upload video to the server');
      }

      const data = await response.json();
      setLiveVideoUrl(data.livePhotostripUrl);
      toast.success('Live photostrip saved successfully!', { id: 'compile-video' });
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to compile live video', { id: 'compile-video' });
    } finally {
      setIsCompilingLiveVideo(false);
    }
  };

  useEffect(() => {
    // Wait slightly for DOM videos to play and settle, then auto compile and upload
    if (currentTemplate && selectedPhotos.length > 0 && !liveVideoUrl && !isCompilingLiveVideo) {
      const timer = setTimeout(() => {
        compileLiveVideo();
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [currentTemplate, selectedPhotos, liveVideoUrl]);

  const handleDownloadLiveVideo = async () => {
    if (!liveVideoUrl) return;
    try {
      toast.loading('Downloading video...', { id: 'download-video' });
      const response = await fetch(liveVideoUrl, { mode: 'cors', credentials: 'omit' });
      if (!response.ok) throw new Error('Failed to fetch file');
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = 'giopix-live-photostrip.webm';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(blobUrl);
      toast.success('Download completed!', { id: 'download-video' });
    } catch (e: any) {
      toast.error('Download failed. Please try again.', { id: 'download-video' });
    }
  };

  const handleDownload = async () => {
    if (!session?.photostripPath) return;
    const url = apiClient.getFileUrl(session.photostripPath);
    try {
      const response = await fetch(url, { mode: 'cors', credentials: 'omit' });
      if (!response.ok) throw new Error('Failed to fetch file');
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = 'giopix-photostrip.jpg';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(blobUrl);
    } catch (e: any) {
      toast.error('Download failed. Please try again.');
    }
  };

  const handlePrint = () => {
    if (!session?.photostripPath) return;
    const imgUrl = apiClient.getFileUrl(session.photostripPath);
    // Hidden iframe approach for reliable printing
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) {
      iframe.remove();
      toast.error('Unable to open print preview.');
      return;
    }

    doc.open();
    doc.write(`<!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Print Photostrip - GioPix</title>
          <style>
            /* Hint printers for 4x6 inch borderless (landscape). If template is 2000x1600, this remains a close ratio. */
            @page { size: 4in 6in; margin: 0; }
            html, body { height: 100%; }
            body { margin: 0; display: flex; align-items: center; justify-content: center; background: #fff; }
            img { width: 100%; height: 100%; object-fit: cover; }
          </style>
        </head>
        <body>
          <img id="strip" src="${imgUrl}" />
          <script>
            const img = document.getElementById('strip');
            img.onload = function () {
              setTimeout(function(){ window.focus(); window.print(); }, 100);
            };
            window.onafterprint = function(){ setTimeout(function(){ window.close(); }, 200); };
          <\/script>
        </body>
      </html>`);
    doc.close();

    // Cleanup in case onafterprint doesn't fire
    setTimeout(() => {
      if (document.body.contains(iframe)) iframe.remove();
    }, 5000);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-4xl text-center"
      >
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Your Photostrip is Ready!
          </h1>
          <p className="text-gray-600">
            Download your amazing photostrip or start a new session
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-8 mb-8">
          {session?.photostripPath ? (
            <div className="flex flex-col items-center">
              <div className="flex items-center gap-3 mb-3">
                {session.photosOnlyPath && session.finalCompositePath && (
                  <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                    <input type="checkbox" checked={showFinal} onChange={(e)=>setShowFinal(e.target.checked)} />
                    <span>{showFinal ? 'Showing Final Composite' : 'Showing Photos Only'}</span>
                  </label>
                )}
              </div>
              <div className="mb-4 flex items-center gap-2">
                <button
                  onClick={() => applyPhotoFilter('none')}
                  disabled={isApplyingFilter || activeFilter === 'none'}
                  className="btn-secondary text-sm disabled:opacity-60"
                >
                  Original
                </button>
                <button
                  onClick={() => applyPhotoFilter('monochrome')}
                  disabled={isApplyingFilter || activeFilter === 'monochrome'}
                  className="btn-secondary text-sm disabled:opacity-60"
                >
                  Monochrome
                </button>
                <button
                  onClick={() => applyPhotoFilter('rio')}
                  disabled={isApplyingFilter || activeFilter === 'rio'}
                  className="btn-secondary text-sm disabled:opacity-60"
                >
                  Rio de Janeiro
                </button>
              </div>
              {/* Segment / Tab Control */}
              <div className="flex justify-center border-b border-gray-100 mb-6 w-full max-w-md">
                {currentTemplate && selectedPhotos.length > 0 && (
                  <button
                    onClick={() => setActiveTab('live')}
                    className={`px-4 py-2 text-sm font-bold border-b-2 transition-all ${
                      activeTab === 'live'
                        ? 'border-primary-600 text-primary-600'
                        : 'border-transparent text-gray-400 hover:text-gray-600'
                    }`}
                  >
                    ⚡ Live Strip
                  </button>
                )}
                <button
                  onClick={() => setActiveTab('static')}
                  className={`px-4 py-2 text-sm font-bold border-b-2 transition-all ${
                    activeTab === 'static'
                      ? 'border-primary-600 text-primary-600'
                      : 'border-transparent text-gray-400 hover:text-gray-600'
                  }`}
                >
                  🖼️ Static Strip
                </button>
                {session?.metadata?.gifUrl && (
                  <button
                    onClick={() => setActiveTab('gif')}
                    className={`px-4 py-2 text-sm font-bold border-b-2 transition-all ${
                      activeTab === 'gif'
                        ? 'border-primary-600 text-primary-600'
                        : 'border-transparent text-gray-400 hover:text-gray-600'
                    }`}
                  >
                    🎬 GIF Moment
                  </button>
                )}
              </div>

              {/* Tab Content Display */}
              <div className="flex flex-col items-center justify-center min-h-[30rem] w-full max-w-sm mx-auto mb-6">
                {activeTab === 'live' && currentTemplate && selectedPhotos.length > 0 && (
                  <div className="w-full animate-fade-in flex flex-col items-center">
                    <span className="text-xs font-semibold text-gray-400 mb-3 uppercase tracking-wider">Interactive Live Photostrip</span>
                    <div 
                      className="w-full shadow-lg rounded-lg overflow-hidden border border-gray-100 relative bg-white"
                      style={{
                        aspectRatio: `${currentTemplate.dimensions.width} / ${currentTemplate.dimensions.height}`,
                        maxHeight: '28rem',
                        width: '100%',
                        maxWidth: `calc(28rem * ${currentTemplate.dimensions.width} / ${currentTemplate.dimensions.height})`
                      }}
                    >
                      {liveVideoUrl ? (
                        <video
                          src={liveVideoUrl}
                          autoPlay
                          muted
                          loop
                          playsInline
                          className="absolute inset-0 w-full h-full object-cover"
                        />
                      ) : (
                        <LivePhotostrip
                          template={currentTemplate}
                          selectedPhotos={selectedPhotos}
                          className="absolute inset-0 w-full h-full"
                        />
                      )}
                    </div>
                  </div>
                )}

                {activeTab === 'static' && (
                  <div className="w-full animate-fade-in flex flex-col items-center">
                    <span className="text-xs font-semibold text-gray-400 mb-3 uppercase tracking-wider">Downloadable Static Photostrip</span>
                    <img
                      src={previewPath ? `${apiClient.getFileUrl(previewPath)}?v=${Date.now()}` : ''}
                      alt="Photostrip"
                      className="max-h-[28rem] w-auto rounded-lg shadow bg-gray-50"
                      onError={(e)=>{(e.currentTarget as HTMLImageElement).style.opacity='0.3';}}
                    />
                  </div>
                )}

                {activeTab === 'gif' && session?.metadata?.gifUrl && (
                  <div className="w-full animate-fade-in flex flex-col items-center">
                    <span className="text-xs font-semibold text-gray-400 mb-3 uppercase tracking-wider">Animated GIF Moment</span>
                    <img
                      src={session.metadata.gifUrl}
                      alt="Animated Moment"
                      className="max-h-[28rem] w-auto rounded-lg shadow bg-gray-50"
                    />
                  </div>
                )}
              </div>

              {/* Bottom live photo gallery */}
              <div className="mt-8 w-full border-t border-gray-100 pt-6">
                <h3 className="text-xs font-semibold text-gray-400 mb-4 uppercase tracking-wider">Hover to play captured live photos</h3>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 justify-center">
                  {photos.map((photo) => (
                    <div key={photo._id} className="aspect-square rounded-lg overflow-hidden border border-gray-100 shadow-sm bg-gray-50">
                      <LivePhotoCard photo={photo} />
                    </div>
                  ))}
                </div>
              </div>
              <div className="mt-6 w-full max-w-2xl">
                {liveVideoUrl ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <SharePanel url={shareUrl} title="Scan for Static Strip" />
                    <SharePanel url={liveVideoUrl} title="Scan for Live Strip" />
                  </div>
                ) : (
                  <SharePanel url={shareUrl} title="Scan for Static Strip" />
                )}
              </div>
            </div>
          ) : (
            <div className="bg-gray-200 rounded-lg h-96 flex items-center justify-center mb-6">
              <p className="text-gray-500">Photostrip preview will appear here</p>
            </div>
          )}
        </div>

        <div className="flex flex-col sm:flex-row justify-center items-center gap-4">
          <button onClick={handleDownload} disabled={!session?.photostripPath} className="btn-primary inline-flex items-center justify-center disabled:opacity-60 w-full sm:w-auto">
            <FiDownload className="mr-2 h-5 w-5" />
            Download Photostrip
          </button>
          {session?.metadata?.gifUrl && (
            <a
              href={session.metadata.gifUrl}
              target="_blank"
              rel="noopener noreferrer"
              download="giopix-moment.gif"
              className="btn-primary bg-purple-600 hover:bg-purple-700 border-purple-600 text-white inline-flex items-center justify-center w-full sm:w-auto text-center"
              style={{ height: '46px', borderRadius: '12px' }}
            >
              <FiDownload className="mr-2 h-5 w-5" />
              Download GIF
            </a>
          )}
          {selectedPhotos.some(p => p.livePhotoPath) && liveVideoUrl && (
            <button
              onClick={handleDownloadLiveVideo}
              className="btn-primary bg-amber-600 hover:bg-amber-700 border-amber-600 text-white inline-flex items-center justify-center w-full sm:w-auto"
              style={{ height: '46px', borderRadius: '12px' }}
            >
              <FiDownload className="mr-2 h-5 w-5" />
              Download Live Strip
            </button>
          )}
          <button
            onClick={handlePrint}
            disabled={!session?.photostripPath}
            className="btn-secondary inline-flex items-center justify-center disabled:opacity-60"
          >
            <FiPrinter className="mr-2 h-5 w-5" />
            Print Photostrip
          </button>
          <button 
            onClick={handleNewSession}
            className="btn-secondary inline-flex items-center justify-center"
          >
            <FiRefreshCw className="mr-2 h-5 w-5" />
            Start New Session
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default CompleteStage;
