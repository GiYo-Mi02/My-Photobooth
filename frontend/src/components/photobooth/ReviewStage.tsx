import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { usePhotoBoothStore } from '../../stores/photoBoothStore';
import toast from 'react-hot-toast';
import LivePhotoCard from './LivePhotoCard';

const ReviewStage = () => {
  const { photos, selectedPhotos, selectPhoto, deselectPhoto, nextStage, previousStage, currentTemplate } = usePhotoBoothStore();

  const requiredCount = useMemo(() => {
    if (!currentTemplate || !Array.isArray(currentTemplate.photoSlots) || currentTemplate.photoSlots.length === 0) {
      return 4; // fallback
    }
    const slots = currentTemplate.photoSlots;
    const w = currentTemplate.dimensions?.width || 1200;
    
    const isTwinStrip = (() => {
      if (slots.length % 2 !== 0) return false;
      const midX = w / 2;
      const leftSlots = slots.filter((s) => (s.x + s.width / 2) < midX);
      const rightSlots = slots.filter((s) => (s.x + s.width / 2) >= midX);
      
      if (leftSlots.length !== rightSlots.length) return false;
      
      const leftSorted = [...leftSlots].sort((a, b) => a.y - b.y);
      const rightSorted = [...rightSlots].sort((a, b) => a.y - b.y);
      
      for (let i = 0; i < leftSorted.length; i++) {
        if (Math.abs(leftSorted[i].y - rightSorted[i].y) > 15) {
          return false;
        }
      }
      return true;
    })();

    if (isTwinStrip) {
      return slots.length / 2;
    }
    return slots.length;
  }, [currentTemplate]);

  const selectedIds = useMemo(() => new Set(selectedPhotos.map(p => p._id)), [selectedPhotos]);

  const toggleSelect = (photoId: string) => {
    if (selectedIds.has(photoId)) {
      deselectPhoto(photoId);
    } else {
      if (selectedPhotos.length >= requiredCount) {
        toast.error(`You can only select exactly ${requiredCount} photos`);
        return;
      }
      selectPhoto(photoId);
    }
  };

  const handleContinue = () => {
    if (selectedPhotos.length !== requiredCount) {
      toast.error(`Please select exactly ${requiredCount} photos to continue`);
      return;
    }
    nextStage();
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-6xl"
      >
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Review Your Photos
          </h1>
          <p className="text-gray-600 font-medium text-primary-600">
            Select exactly {requiredCount} photos for the photostrip
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-4 mb-8">
          {photos.map((photo) => {
            const isSel = selectedIds.has(photo._id);
            return (
              <button
                type="button"
                key={photo._id}
                onClick={() => toggleSelect(photo._id)}
                className={`aspect-square rounded-lg overflow-hidden border-2 transition-all ${isSel ? 'border-primary-600 ring-2 ring-primary-500 ring-offset-2' : 'border-gray-300 hover:border-primary-400'}`}
                title={isSel ? 'Deselect' : 'Select'}
              >
                <LivePhotoCard
                  photo={photo}
                  isSelected={isSel}
                />
              </button>
            );
          })}
        </div>

        <div className="flex justify-center space-x-4">
          <button onClick={previousStage} className="btn-secondary">
            Back to Capture
          </button>
          <button onClick={handleContinue} className="btn-primary">
            Continue to Templates
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default ReviewStage;
