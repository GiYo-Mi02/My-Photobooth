import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FiCamera, FiImage, FiFilter, FiDownload, FiUsers, FiZap } from 'react-icons/fi';

const Home = () => {
  const features = [
    { icon: <FiCamera className="h-8 w-8" />, title: '10 Photo Sessions', description: 'Take up to 10 photos with 5-second intervals between each shot.' },
    { icon: <FiFilter className="h-8 w-8" />, title: 'Filter Effects', description: 'Apply filters like B&W, sepia, vintage, and more to your photos.' },
    { icon: <FiImage className="h-8 w-8" />, title: 'Custom Templates', description: 'Choose photostrip templates or upload your own designs.' },
    { icon: <FiDownload className="h-8 w-8" />, title: 'Instant Download', description: 'Generate and download your photostrip instantly.' },
    { icon: <FiUsers className="h-8 w-8" />, title: 'Admin Dashboard', description: 'Manage templates, sessions, and users with ease.' },
    { icon: <FiZap className="h-8 w-8" />, title: 'Fast & Responsive', description: 'Lightning-fast processing with a smooth interface.' },
  ];

  const steps = [
    { step: '01', title: 'Start Session', description: 'Click start to begin your GPix session.' },
    { step: '02', title: 'Take Photos', description: 'Capture up to 10 photos with 5-second intervals.' },
    { step: '03', title: 'Select & Filter', description: 'Choose your favorites and apply filters.' },
    { step: '04', title: 'Generate Strip', description: 'Create and download your custom photostrip.' },
  ];

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-primary-600 via-primary-700 to-primary-800 text-white">
        <div className="absolute inset-0 bg-black/20" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 lg:py-32">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }} className="text-center">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold font-display mb-6">
              Create Amazing
              <span className="block text-secondary-300">GPix Moments</span>
            </h1>
            <p className="text-xl sm:text-2xl text-primary-100 mb-8 max-w-3xl mx-auto">
              Take photos, apply filters, and create beautiful photostrips with our interactive photobooth experience.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/photobooth" className="btn-primary inline-flex items-center justify-center text-lg shadow">
                <FiCamera className="mr-2 h-5 w-5" />
                Start GPix
              </Link>
              <Link to="/register" className="bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/20 text-white font-semibold px-8 py-4 rounded-xl text-lg transition-colors duration-200">
                Create Account
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-cream-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }} viewport={{ once: true }} className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">Everything You Need</h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">Our photobooth comes packed with features to make your experience memorable and fun.</p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <motion.div key={index} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: index * 0.1 }} viewport={{ once: true }} className="text-center p-6 rounded-xl hover:bg-cream-100 transition-colors duration-200">
                <div className="text-primary-600 mb-4 flex justify-center">{feature.icon}</div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">{feature.title}</h3>
                <p className="text-gray-600">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }} viewport={{ once: true }} className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">How It Works</h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">Simple steps to create your perfect photostrip in minutes.</p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {steps.map((step, index) => (
              <motion.div key={index} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: index * 0.2 }} viewport={{ once: true }} className="text-center">
                <div className="bg-primary-600 text-white w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold mx-auto mb-4">{step.step}</div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{step.title}</h3>
                <p className="text-gray-600 text-sm">{step.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-primary-600">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }} viewport={{ once: true }}>
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">Ready to Get Started?</h2>
            <p className="text-xl text-primary-100 mb-8 max-w-2xl mx-auto">Create your first photostrip today and experience the magic of our interactive photobooth.</p>
            <Link to="/photobooth" className="btn-primary inline-flex items-center justify-center text-lg shadow">
              <FiCamera className="mr-2 h-5 w-5" />
              Launch GPix
            </Link>
          </motion.div>
        </div>
      </section>
    </div>
  );
};

export default Home;
