import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { usePhotoBoothStore } from '../../stores/photoBoothStore';
import toast from 'react-hot-toast';

const GenerateStage = () => {
  const { nextStage, previousStage, generatePhotostrip, generatePhotostripDual3x2, selectedPhotos } = usePhotoBoothStore();
  const [useDual, setUseDual] = useState(true);
  const [isGenerating, setIsGenerating] = useState(true);

  const ranRef = useRef(false);
  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;
    let mounted = true;
    (async () => {
      try {
        if (useDual && selectedPhotos.length >= 1) {
          await generatePhotostripDual3x2();
        } else {
          await generatePhotostrip();
        }
        if (mounted) {
          setIsGenerating(false);
          nextStage();
        }
      } catch (e: any) {
        toast.error(e?.message || 'Failed to generate photostrip');
        setIsGenerating(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-4xl text-center"
      >
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Generating Your Photostrip
          </h1>
          <p className="text-gray-600">
            Please wait while we create your amazing photostrip...
          </p>
        </div>

        <div className="bg-white rounded-lg shadow p-8 mb-8">
          <div className="loading-spinner w-12 h-12 mx-auto mb-4"></div>
          <p className="text-gray-500">Processing your photos...</p>
          <div className="mt-4 flex items-center justify-center gap-2 text-xs text-gray-600">
            <label className="inline-flex items-center gap-1 cursor-pointer select-none">
              <input type="checkbox" className="accent-primary-500" checked={useDual} onChange={(e)=>setUseDual(e.target.checked)} />
              <span>Dual 3x2 Layout</span>
            </label>
            <span className="opacity-70">•</span>
            <span>{selectedPhotos.length} selected</span>
          </div>
        </div>

        <div className="flex justify-center space-x-4">
          <button onClick={previousStage} className="btn-secondary">
            Back to Templates
          </button>
          <button onClick={nextStage} disabled={isGenerating} className="btn-primary disabled:opacity-60">
            View Result
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default GenerateStage;
