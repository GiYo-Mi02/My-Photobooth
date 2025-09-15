import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { FiCamera, FiUser, FiLogOut, FiSettings } from 'react-icons/fi';

const Header = () => {
  const { user, isAuthenticated, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-2 group">
            <FiCamera className="h-8 w-8 text-secondary-500 group-hover:text-secondary-600 transition-colors" />
            <span className="text-xl font-bold text-gray-900">GioPix</span>
          </Link>

          {/* Navigation */}
          <nav className="hidden md:flex items-center space-x-8">
            <Link 
              to="/" 
              className="text-gray-600 hover:text-gray-900 transition-colors duration-200"
            >
              Home
            </Link>
            <Link 
              to="/photobooth" 
              className="text-gray-600 hover:text-gray-900 transition-colors duration-200"
            >
              GioPix
            </Link>
            {isAuthenticated && user?.role === 'admin' && (
              <Link 
                to="/admin" 
                className="text-gray-600 hover:text-gray-900 transition-colors duration-200"
              >
                Admin
              </Link>
            )}
          </nav>

          {/* User Menu */}
          <div className="flex items-center space-x-4">
            {isAuthenticated ? (
              <div className="flex items-center space-x-3">
                <div className="flex items-center space-x-2">
                  <FiUser className="h-5 w-5 text-gray-500" />
                  <span className="text-sm font-medium text-gray-700">
                    {user?.username}
                  </span>
                  {user?.role === 'admin' && (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-primary-100 text-primary-800">
                      Admin
                    </span>
                  )}
                </div>
                
                {user?.role === 'admin' && (
                  <Link
                    to="/admin"
                    className="p-2 text-gray-500 hover:text-gray-700 transition-colors duration-200"
                    title="Admin Dashboard"
                  >
                    <FiSettings className="h-5 w-5" />
                  </Link>
                )}
                
                <button
                  onClick={handleLogout}
                  className="p-2 text-gray-500 hover:text-gray-700 transition-colors duration-200"
                  title="Logout"
                >
                  <FiLogOut className="h-5 w-5" />
                </button>
              </div>
            ) : (
              <div className="flex items-center space-x-3">
                <Link
                  to="/login"
                  className="text-gray-600 hover:text-gray-900 transition-colors duration-200"
                >
                  Login
                </Link>
                <Link
                  to="/register"
                  className="btn-primary"
                >
                  Get Started
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Navigation */}
      <div className="md:hidden border-t border-gray-200">
        <div className="px-4 py-3 space-y-2">
          <Link 
            to="/" 
            className="block px-3 py-2 text-gray-600 hover:text-gray-900 hover:bg-cream-100 rounded-md transition-colors duration-200"
          >
            Home
          </Link>
          <Link 
            to="/photobooth" 
            className="block px-3 py-2 text-gray-600 hover:text-gray-900 hover:bg-cream-100 rounded-md transition-colors duration-200"
          >
            GioPix
          </Link>
          {isAuthenticated && user?.role === 'admin' && (
            <Link 
              to="/admin" 
              className="block px-3 py-2 text-gray-600 hover:text-gray-900 hover:bg-cream-100 rounded-md transition-colors duration-200"
            >
              Admin
            </Link>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
