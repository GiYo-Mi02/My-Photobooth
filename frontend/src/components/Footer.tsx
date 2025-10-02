import { FiHeart } from 'react-icons/fi';
import GPixLogo from '../assets/GPixLogo.png';

const Footer = () => {
  return (
    <footer className="bg-white border-t border-gray-200 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
      <div className="col-span-1 md:col-span-2">
            <div className="flex items-center space-x-3 mb-4">
        <img
          src={GPixLogo}
          alt="GPix logo"
          className="h-8 w-8 rounded-lg shadow-sm ring-1 ring-cream-200"
        />
        <span className="text-lg font-bold text-gray-900 tracking-tight">GPix</span>
            </div>
            <p className="text-gray-600 text-sm max-w-md">
              Capture modern memories with the reimagined GPix photobooth experience.
              Snap photos, apply creative filters, and craft beautifully branded photostrips in seconds.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Quick Links</h3>
            <ul className="space-y-2">
              <li>
                <a href="/" className="text-sm text-gray-600 hover:text-gray-900 transition-colors duration-200">
                  Home
                </a>
              </li>
              <li>
                <a href="/photobooth" className="text-sm text-gray-600 hover:text-gray-900 transition-colors duration-200">
                  GPix Booth
                </a>
              </li>
              <li>
                <a href="/login" className="text-sm text-gray-600 hover:text-gray-900 transition-colors duration-200">
                  Login
                </a>
              </li>
              <li>
                <a href="/register" className="text-sm text-gray-600 hover:text-gray-900 transition-colors duration-200">
                  Register
                </a>
              </li>
            </ul>
          </div>

          {/* Features */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Features</h3>
            <ul className="space-y-2">
              <li className="text-sm text-gray-600">10 Photo Sessions</li>
              <li className="text-sm text-gray-600">Custom Templates</li>
              <li className="text-sm text-gray-600">Filter Effects</li>
              <li className="text-sm text-gray-600">Instant Photostrips</li>
              <li className="text-sm text-gray-600">Admin Dashboard</li>
            </ul>
          </div>
        </div>

        {/* Bottom Section */}
        <div className="border-t border-gray-200 pt-6 mt-8">
          <div className="flex flex-col sm:flex-row justify-between items-center">
            <p className="text-sm text-gray-600">
              © {new Date().getFullYear()} GPix. All rights reserved.
            </p>
            <p className="text-sm text-gray-600 flex items-center mt-2 sm:mt-0">
              Made with <FiHeart className="h-4 w-4 text-red-500 mx-1" /> by GPix Studios
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
