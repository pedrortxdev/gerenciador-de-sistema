"use client";

import { useState, useEffect } from 'react';
import axios from 'axios';
import Cookies from 'js-cookie';
import { DNSRecord, CloudflareResponse } from '../types/api';

export default function DNSManager() {
  const [records, setRecords] = useState<DNSRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingRecord, setEditingRecord] = useState<DNSRecord | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    type: 'A',
    name: '',
    content: '',
    proxied: true,
    ttl: 1
  });

  const getAuthHeader = () => {
    const token = Cookies.get('auth_token');
    if (token) {
      return { headers: { Authorization: `Bearer ${token}` } };
    }
    return {};
  };

  useEffect(() => {
    fetchRecords();
  }, []);

  const fetchRecords = async () => {
    setLoading(true);
    try {
      const res = await axios.get<CloudflareResponse>('/api/cloudflare/records', getAuthHeader());
      
      // Axios automatically throws for non-2xx range if configured, but we check response data structure
      if (Array.isArray(res.data)) {
         // Handle case where backend returns raw array (if changed) or mapped directly
         setRecords(res.data);
      } else if (res.data.success) {
         setRecords(res.data.result);
      } else {
         // Fallback if backend returns the raw bytes that were not parsed as JSON correctly or structure mismatch
         console.warn("Unexpected API response structure", res.data);
         // Try to recover if it's a direct list
         if (Array.isArray(res.data)) setRecords(res.data);
      }
    } catch (err: any) {
      console.error(err);
      setError('Error loading DNS records: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this record?')) return;

    try {
      await axios.delete(`/api/cloudflare/record/${id}`, getAuthHeader());
      setRecords(records.filter(r => r.id !== id));
    } catch (err: any) {
      alert('Error deleting record: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const isEdit = !!editingRecord;
      const url = isEdit 
        ? `/api/cloudflare/record/${editingRecord.id}`
        : '/api/cloudflare/add-record';
      
      const payload = { ...formData };
      
      if (isEdit) {
         await axios.put(url, payload, getAuthHeader());
      } else {
         await axios.post(url, payload, getAuthHeader());
      }

      closeModal();
      fetchRecords(); // Refresh list
    } catch (err: any) {
      alert('Operation failed: ' + (err.response?.data?.error || err.message));
    }
  };

  const openModal = (record?: DNSRecord) => {
    if (record) {
      setEditingRecord(record);
      setFormData({
        type: record.type,
        name: record.name,
        content: record.content,
        proxied: record.proxied,
        ttl: record.ttl
      });
    } else {
      setEditingRecord(null);
      setFormData({
        type: 'A',
        name: '',
        content: '',
        proxied: true,
        ttl: 1
      });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingRecord(null);
  };

  return (
    <div className="p-6 bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-slate-800 dark:text-white">DNS Records</h2>
        <button 
          onClick={() => openModal()}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md transition text-sm font-medium shadow-sm"
        >
          + Add Record
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-500">Loading records...</div>
      ) : error ? (
        <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-md text-sm">{error}</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                <th className="p-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Type</th>
                <th className="p-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Name</th>
                <th className="p-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Content</th>
                <th className="p-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">TTL</th>
                <th className="p-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Proxy Status</th>
                <th className="p-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {records.map(record => (
                <tr key={record.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                  <td className="p-3">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300 font-mono">
                      {record.type}
                    </span>
                  </td>
                  <td className="p-3 text-sm text-slate-700 dark:text-slate-300 font-medium">{record.name}</td>
                  <td className="p-3 text-sm text-slate-600 dark:text-slate-400 font-mono truncate max-w-xs" title={record.content}>{record.content}</td>
                  <td className="p-3 text-sm text-slate-600 dark:text-slate-400">{record.ttl === 1 ? 'Auto' : record.ttl}</td>
                  <td className="p-3">
                    {record.proxied ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-orange-500"></span>
                        Proxied
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                        DNS Only
                      </span>
                    )}
                  </td>
                  <td className="p-3 text-right space-x-2">
                    <button 
                      onClick={() => openModal(record)}
                      className="text-blue-600 dark:text-blue-400 hover:underline text-sm font-medium"
                    >
                      Edit
                    </button>
                    <button 
                      onClick={() => handleDelete(record.id)}
                      className="text-red-600 dark:text-red-400 hover:underline text-sm font-medium"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-xl w-full max-w-md border border-slate-200 dark:border-slate-700">
            <h3 className="text-lg font-bold mb-4 text-slate-900 dark:text-white">{editingRecord ? 'Edit DNS Record' : 'Add DNS Record'}</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Type</label>
                <select 
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-md p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  value={formData.type}
                  onChange={(e) => setFormData({...formData, type: e.target.value})}
                >
                  {['A', 'AAAA', 'CNAME', 'TXT', 'MX', 'NS'].map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Name</label>
                <input 
                  type="text"
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-md p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  placeholder="e.g., www, @, blog"
                  required
                />
                <p className="text-xs text-slate-500 mt-1">Use @ for root domain</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Content</label>
                <input 
                  type="text"
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-md p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  value={formData.content}
                  onChange={(e) => setFormData({...formData, content: e.target.value})}
                  placeholder="IPv4, IPv6, or domain name"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">TTL</label>
                <select 
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-md p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  value={formData.ttl}
                  onChange={(e) => setFormData({...formData, ttl: parseInt(e.target.value)})}
                >
                  <option value={1}>Auto</option>
                  <option value={120}>2 min</option>
                  <option value={300}>5 min</option>
                  <option value={3600}>1 hour</option>
                </select>
              </div>

              <div className="flex items-center space-x-2 pt-2">
                <input 
                  type="checkbox"
                  id="proxied"
                  checked={formData.proxied}
                  onChange={(e) => setFormData({...formData, proxied: e.target.checked})}
                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="proxied" className="text-sm font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                   Proxy through Cloudflare (CDN)
                </label>
              </div>

              <div className="flex justify-end space-x-3 mt-6 pt-4 border-t border-slate-100 dark:border-slate-700">
                <button 
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md transition"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium shadow-sm transition"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}