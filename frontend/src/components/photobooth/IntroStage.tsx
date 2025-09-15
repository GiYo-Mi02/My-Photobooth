import { motion } from 'framer-motion';
import { FiCamera, FiPlay } from 'react-icons/fi';
import { usePhotoBoothStore } from '../../stores/photoBoothStore';

const IntroStage = () => {
  const { createSession } = usePhotoBoothStore();

  const handleStart = async () => {
    try {
      await createSession();
    } catch (error) {
      console.error('Failed to create session:', error);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6 }}
        className="text-center max-w-2xl mx-auto px-6"
      >
        <div className="mb-8">
          <FiCamera className="h-24 w-24 text-primary-600 mx-auto mb-6" />
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            Welcome to GioPix
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            Get ready to capture amazing moments! You'll have 10 photo opportunities 
            with 5 seconds between each shot.
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-8 mb-8">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">How it works:</h2>
          <div className="space-y-4 text-left">
            <div className="flex items-center space-x-3">
              <div className="bg-primary-100 text-primary-600 rounded-full w-8 h-8 flex items-center justify-center font-semibold">1</div>
              <span className="text-gray-700">Take up to 10 photos with automatic timer</span>
            </div>
            <div className="flex items-center space-x-3">
              <div className="bg-primary-100 text-primary-600 rounded-full w-8 h-8 flex items-center justify-center font-semibold">2</div>
              <span className="text-gray-700">Review and select your favorite shots</span>
            </div>
            <div className="flex items-center space-x-3">
              <div className="bg-primary-100 text-primary-600 rounded-full w-8 h-8 flex items-center justify-center font-semibold">3</div>
              <span className="text-gray-700">Apply filters and choose a template</span>
            </div>
            <div className="flex items-center space-x-3">
              <div className="bg-primary-100 text-primary-600 rounded-full w-8 h-8 flex items-center justify-center font-semibold">4</div>
              <span className="text-gray-700">Generate and download your photostrip</span>
            </div>
          </div>
        </div>

        <button
          onClick={handleStart}
          className="bg-primary-600 hover:bg-primary-700 text-white font-semibold px-12 py-4 rounded-xl text-xl transition-colors duration-200 inline-flex items-center justify-center"
        >
          <FiPlay className="mr-3 h-6 w-6" />
          Start GioPix Session
        </button>
      </motion.div>
    </div>
  );
};

export default IntroStage;
