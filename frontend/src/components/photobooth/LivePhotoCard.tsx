import { useState, useRef } from 'react';
import type { Photo } from '../../types';

interface LivePhotoCardProps {
  photo: Photo;
  isSelected?: boolean;
  className?: string;
  imgClassName?: string;
}

export const LivePhotoCard = ({
  photo,
  isSelected = false,
  className = '',
  imgClassName = '',
}: LivePhotoCardProps) => {
  const [isHovered, setIsHovered] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const handleMouseEnter = () => {
    setIsHovered(true);
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play().catch((err) => {
        // Safe catch for potential play interaction restrictions
        console.debug('Video autoplay blocked or interrupted:', err);
      });
    }
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    if (videoRef.current) {
      videoRef.current.pause();
    }
  };

  const baseUrl = 'http://localhost:5000';
  const getUrl = (pathStr?: string) => {
    if (!pathStr) return '';
    return /^https?:\/\//i.test(pathStr) ? pathStr : `${baseUrl}${pathStr}`;
  };

  return (
    <div
      className={`relative w-full h-full overflow-hidden rounded-lg ${className}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <img
        src={getUrl(photo.path)}
        alt={`Photo ${photo.photoNumber}`}
        className={`w-full h-full object-cover transition-all duration-300 ${isSelected ? 'scale-[1.02]' : ''} ${isHovered && photo.livePhotoPath ? 'opacity-0 scale-[1.02]' : 'opacity-100'} ${imgClassName}`}
      />

      {photo.livePhotoPath && (
        <video
          ref={videoRef}
          src={getUrl(photo.livePhotoPath)}
          muted
          loop
          playsInline
          className={`absolute inset-0 w-full h-full object-cover transition-all duration-300 pointer-events-none ${isHovered ? 'opacity-100 scale-[1.02]' : 'opacity-0'}`}
        />
      )}

      {/* Premium Apple-style Live Badge in top-left */}
      {photo.livePhotoPath && (
        <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-md px-1.5 py-0.5 rounded text-[10px] text-white flex items-center space-x-1 uppercase font-bold tracking-wider pointer-events-none select-none">
          <span className="w-1.5 h-1.5 bg-yellow-400 rounded-full animate-pulse"></span>
          <span>Live</span>
        </div>
      )}
    </div>
  );
};

export default LivePhotoCard;
