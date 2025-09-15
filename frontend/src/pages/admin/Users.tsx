import { useEffect, useState } from 'react';
import { authService } from '../../services/auth';
import type { User } from '../../types';
import toast from 'react-hot-toast';

const Users = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');

  const load = async (opts?: { page?: number }) => {
    setLoading(true);
    try {
      const res = await authService.getAllUsers({ page: opts?.page || page, limit: 12, search: search || undefined });
      setUsers(res.users);
      setPage(res.pagination.current);
      setPages(res.pagination.pages);
      setTotal(res.pagination.total);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load({ page: 1 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-cream-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">User Management</h1>
          <p className="text-gray-600 mt-2">
            Manage registered users and their permissions
          </p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-4">
            <input className="input" placeholder="Search username or email" value={search} onChange={(e)=>setSearch(e.target.value)} />
            <button className="btn-primary" onClick={()=>load({ page: 1 })}>Search</button>
            <button className="btn-ghost" onClick={()=>{ setSearch(''); load({ page: 1 }); }}>Clear</button>
          </div>

          {loading ? (
            <div className="text-center py-16 text-gray-500">Loading...</div>
          ) : users.length === 0 ? (
            <div className="text-center py-16 text-gray-500">No users found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-cream-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Username</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {users.map(u => (
                    <tr key={u._id}>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{u.username}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{u.email}</td>
                      <td className="px-4 py-3 text-sm"><span className={`px-2 py-0.5 rounded text-xs ${u.role==='admin'?'bg-purple-100 text-purple-700':'bg-gray-100 text-gray-700'}`}>{u.role}</span></td>
                      <td className="px-4 py-3 text-sm">{u.isActive ? <span className="text-green-700">Active</span> : <span className="text-gray-500">Inactive</span>}</td>
                      <td className="px-4 py-3 text-sm text-right">{new Date(u.createdAt!).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex items-center justify-between mt-4">
            <div className="text-sm text-gray-600">Page {page} of {pages} • {total} users</div>
            <div className="space-x-2">
              <button className="btn-ghost" disabled={page<=1} onClick={()=>load({ page: page-1 })}>Previous</button>
              <button className="btn-ghost" disabled={page>=pages} onClick={()=>load({ page: page+1 })}>Next</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Users;
