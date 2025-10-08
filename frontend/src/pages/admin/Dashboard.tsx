import { useEffect, useState } from 'react';
import { FiUsers, FiImage, FiCamera, FiTrendingUp } from 'react-icons/fi';
import { apiClient } from '../../lib/api';
import { Link } from 'react-router-dom';

type AdminStats = {
  totals: { totalUsers: number; totalSessions: number; totalTemplates: number; totalPhotos: number };
  sessionsByStatus: Record<string, number>;
  topTemplates: Array<{ _id: string; name: string; usageCount: number; category: string; thumbnailPath?: string; path: string }>;
  dailySessions: Array<{ date: string | Date; count: number }>;
};

const Dashboard = () => {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await apiClient.get<AdminStats>('/admin/stats');
        setStats(data);
      } catch (e) {
        // handled by interceptor toast
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  return (
  <div className="min-h-screen bg-cream-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
          <p className="text-gray-600 mt-2">
            Welcome to the GioPix admin panel
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-primary-100 rounded-lg">
                <FiUsers className="h-6 w-6 text-primary-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Users</p>
                <p className="text-2xl font-semibold text-gray-900">{loading ? '—' : stats?.totals.totalUsers ?? 0}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <FiCamera className="h-6 w-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Sessions</p>
                <p className="text-2xl font-semibold text-gray-900">{loading ? '—' : stats?.totals.totalSessions ?? 0}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <FiImage className="h-6 w-6 text-yellow-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Templates</p>
                <p className="text-2xl font-semibold text-gray-900">{loading ? '—' : stats?.totals.totalTemplates ?? 0}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 rounded-lg">
                <FiTrendingUp className="h-6 w-6 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Photos</p>
                <p className="text-2xl font-semibold text-gray-900">{loading ? '—' : stats?.totals.totalPhotos ?? 0}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link className="btn-primary text-center" to="/admin/templates">Upload New Template</Link>
            <Link className="btn-secondary text-center" to="/admin/sessions">View All Sessions</Link>
            <Link className="btn-secondary text-center" to="/admin/users">Manage Users</Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
