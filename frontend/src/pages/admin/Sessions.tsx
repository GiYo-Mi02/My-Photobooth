import { useEffect, useState } from 'react';
import { sessionService } from '../../services/sessions';
import type { Session } from '../../types';
import toast from 'react-hot-toast';

const Sessions = () => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState<string>('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [stats, setStats] = useState<Array<{ _id: string; count: number; avgPhotos: number; avgDuration: number }>>([]);

  const load = async (opts?: { page?: number }) => {
    setLoading(true);
    try {
      const res = await sessionService.getAllSessions({
        page: opts?.page || page,
        limit: 12,
        status: status || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      });
      setSessions(res.sessions as any);
      setStats(res.stats);
      setPage(res.pagination.current);
      setPages(res.pagination.pages);
      setTotal(res.pagination.total);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to load sessions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load({ page: 1 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyFilters = () => load({ page: 1 });
  const clearFilters = () => {
    setStatus('');
    setStartDate('');
    setEndDate('');
    load({ page: 1 });
  };

  const handleDelete = async (sessionId: string) => {
    if (!confirm('Delete this session and its photos?')) return;
    try {
      await sessionService.deleteSession(sessionId);
      toast.success('Session deleted');
      load();
    } catch (e: any) {
      toast.error(e?.message || 'Delete failed');
    }
  };

  return (
    <div className="min-h-screen bg-cream-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Session Management</h1>
          <p className="text-gray-600 mt-2">View and manage all photobooth sessions</p>
        </div>

        {/* Filters & stats */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <div className="bg-white rounded-lg shadow p-4 lg:col-span-2">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="">All Status</option>
                <option value="active">active</option>
                <option value="completed">completed</option>
                <option value="cancelled">cancelled</option>
              </select>
              <input type="date" className="input" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              <input type="date" className="input" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              <div className="flex gap-2">
                <button className="btn-primary w-full" onClick={applyFilters}>Apply</button>
                <button className="btn-ghost w-full" onClick={clearFilters}>Clear</button>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-500 mb-2">Stats</div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <div className="text-xs text-gray-500">Total</div>
                <div className="text-lg font-semibold">{total}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Completed</div>
                <div className="text-lg font-semibold">{stats.find(s=>s._id==='completed')?.count || 0}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Avg Photos</div>
                <div className="text-lg font-semibold">{Math.round((stats.reduce((a,s)=>a+(s.avgPhotos||0),0)/(stats.length||1))||0)}</div>
              </div>
            </div>
          </div>
        </div>

        {/* List */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {loading ? (
            <div className="text-center py-16 text-gray-500">Loading...</div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-16 text-gray-500">No sessions found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-cream-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Session ID</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Photos</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Template</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {sessions.map((s) => (
                    <tr key={s.sessionId}>
                      <td className="px-4 py-3 font-mono text-sm text-gray-800">{s.sessionId}</td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`px-2 py-0.5 rounded text-xs ${s.status==='completed'?'bg-green-100 text-green-700':s.status==='active'?'bg-blue-100 text-blue-700':'bg-gray-100 text-gray-700'}`}>{s.status}</span>
                      </td>
                      <td className="px-4 py-3 text-sm">{s.totalPhotos}</td>
                      <td className="px-4 py-3 text-sm">{s.templateId ? 'Yes' : '—'}</td>
                      <td className="px-4 py-3 text-sm">{new Date(s.createdAt).toLocaleString()}</td>
                      <td className="px-4 py-3 text-sm text-right">
                        <button className="text-red-600 hover:underline" onClick={() => handleDelete(s.sessionId)}>Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between mt-4">
          <div className="text-sm text-gray-600">Page {page} of {pages}</div>
          <div className="space-x-2">
            <button className="btn-ghost" disabled={page<=1} onClick={()=>load({ page: page-1 })}>Previous</button>
            <button className="btn-ghost" disabled={page>=pages} onClick={()=>load({ page: page+1 })}>Next</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Sessions;
