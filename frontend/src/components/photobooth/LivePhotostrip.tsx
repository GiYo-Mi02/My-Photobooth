import React from 'react';
import type { Template, Photo } from '../../types';

interface LivePhotostripProps {
  template: Template;
  selectedPhotos: Photo[];
  className?: string;
}

export const LivePhotostrip = ({
  template,
  selectedPhotos,
  className = '',
}: LivePhotostripProps) => {
  if (!template || !selectedPhotos.length) return null;

  const { width: tWidth, height: tHeight } = template.dimensions;
  const baseUrl = 'http://localhost:5000';
  const getUrl = (pathStr?: string) => {
    if (!pathStr) return '';
    return /^https?:\/\//i.test(pathStr) ? pathStr : `${baseUrl}${pathStr}`;
  };

  // Check if template frame artwork should lay on top of photos
  const templateOverPhotos = (template.metadata as any)?.templateOverPhotos === true;

  return (
    <div
      className={`relative shadow-lg overflow-hidden rounded-lg bg-white border border-gray-100 ${className}`}
      style={{
        width: '100%',
        aspectRatio: `${tWidth} / ${tHeight}`,
      }}
    >
      {/* Template Background Image */}
      <img
        src={getUrl(template.path)}
        alt={template.name}
        className="absolute inset-0 w-full h-full object-cover select-none pointer-events-none"
        style={{ zIndex: 10 }}
        crossOrigin="anonymous"
      />

      {/* Live Photos in Slots */}
      {template.photoSlots.map((slot, index) => {
        const photo = selectedPhotos[index % selectedPhotos.length];
        if (!photo) return null;

        // Position as percentages of template dimensions
        const style: React.CSSProperties = {
          position: 'absolute',
          left: `${(slot.x / tWidth) * 100}%`,
          top: `${(slot.y / tHeight) * 100}%`,
          width: `${(slot.width / tWidth) * 100}%`,
          height: `${(slot.height / tHeight) * 100}%`,
          transform: `rotate(${slot.rotation || 0}deg)`,
          overflow: 'hidden',
          zIndex: templateOverPhotos ? 0 : 20,
        };

        return (
          <div key={`${photo._id}-${index}`} style={style} className="z-0 bg-gray-100">
            {photo.livePhotoPath ? (
              <video
                id={`strip-video-${index}`}
                src={getUrl(photo.livePhotoPath)}
                autoPlay
                muted
                loop
                playsInline
                className="w-full h-full object-cover scale-[1.02]"
                crossOrigin="anonymous"
              />
            ) : (
              <img
                src={getUrl(photo.path)}
                alt={`Photo ${photo.photoNumber}`}
                className="w-full h-full object-cover"
                crossOrigin="anonymous"
              />
            )}
          </div>
        );
      })}
    </div>
  );
};

export default LivePhotostrip;
