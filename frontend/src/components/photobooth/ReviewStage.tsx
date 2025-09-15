import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { usePhotoBoothStore } from '../../stores/photoBoothStore';
import toast from 'react-hot-toast';

const ReviewStage = () => {
  const { photos, selectedPhotos, selectPhoto, deselectPhoto, nextStage, previousStage } = usePhotoBoothStore();

  const selectedIds = useMemo(() => new Set(selectedPhotos.map(p => p._id)), [selectedPhotos]);

  const toggleSelect = (photoId: string) => {
    if (selectedIds.has(photoId)) {
      deselectPhoto(photoId);
    } else {
      selectPhoto(photoId);
    }
  };

  const handleContinue = () => {
    if (selectedPhotos.length === 0) {
      toast.error('Please select at least one photo to continue');
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
          <p className="text-gray-600">
            Select your favorite photos for the photostrip
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
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
                <img
                  src={`http://localhost:5000${photo.path}`}
                  alt={`Photo ${photo.photoNumber}`}
                  className={`w-full h-full object-cover ${isSel ? 'scale-[1.02]' : ''}`}
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
