import { useState, useEffect } from 'react';
import axios from 'axios';
import { FirewallRule } from '@/types/api';
import { Shield, Trash2, Plus, CheckCircle, AlertCircle } from 'lucide-react';

const API_URL = '/api';

export default function FirewallManager() {
  const [rules, setRules] = useState<FirewallRule[]>([]);
  const [status, setStatus] = useState('unknown');
  const [loading, setLoading] = useState(false);
  const [port, setPort] = useState('');
  const [proto, setProto] = useState(''); // 'tcp', 'udp' or ''
  
  const fetchFirewall = async () => {
    try {
      const res = await axios.get(`${API_URL}/firewall`);
      setRules(res.data.rules || []);
      setStatus(res.data.status);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchFirewall();
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!port) return;
    setLoading(true);
    try {
      await axios.post(`${API_URL}/firewall/add`, { port, proto });
      setPort('');
      setProto('');
      fetchFirewall();
    } catch (err) {
      alert("Failed to add rule");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(`Delete rule #${id}? This might affect connectivity.`)) return;
    try {
      await axios.post(`${API_URL}/firewall/delete`, { id });
      fetchFirewall();
    } catch (err) {
      alert("Failed to delete rule");
    }
  };

  return (
    <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-md border border-slate-200 dark:border-slate-700 mb-8">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-slate-800 dark:text-white flex items-center gap-2">
          <Shield className={`w-5 h-5 ${status === 'active' ? 'text-green-500' : 'text-red-500'}`} /> 
          Firewall (UFW)
        </h3>
        <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${
          status === 'active' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700'
        }`}>
          {status}
        </span>
      </div>

      {/* Add Rule Form */}
      <form onSubmit={handleAdd} className="flex gap-2 mb-6 p-4 bg-slate-50 dark:bg-slate-900 rounded-lg">
        <input
          type="text"
          placeholder="Port (e.g. 8080)"
          className="flex-1 px-3 py-2 rounded border dark:bg-slate-800 dark:border-slate-700 text-sm"
          value={port}
          onChange={e => setPort(e.target.value)}
        />
        <select
          className="px-3 py-2 rounded border dark:bg-slate-800 dark:border-slate-700 text-sm"
          value={proto}
          onChange={e => setProto(e.target.value)}
        >
          <option value="">Both</option>
          <option value="tcp">TCP</option>
          <option value="udp">UDP</option>
        </select>
        <button 
          type="submit" 
          disabled={loading || !port}
          className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          <Plus className="w-4 h-4" />
        </button>
      </form>

      {/* Rules List */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700">
              <th className="p-3 text-slate-500">ID</th>
              <th className="p-3 text-slate-500">To</th>
              <th className="p-3 text-slate-500">Action</th>
              <th className="p-3 text-slate-500">From</th>
              <th className="p-3 text-right text-slate-500">Action</th>
            </tr>
          </thead>
          <tbody>
            {rules.map((rule) => (
              <tr key={rule.id} className="border-b border-slate-100 dark:border-slate-800 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-750">
                <td className="p-3 font-mono text-slate-400">[{rule.id}]</td>
                <td className="p-3 font-medium text-blue-600 dark:text-blue-400">{rule.to}</td>
                <td className="p-3">
                  <span className={`px-2 py-0.5 rounded text-xs font-bold ${rule.action.includes('ALLOW') ? 'text-green-600 bg-green-50' : 'text-red-600 bg-red-50'}`}>
                    {rule.action}
                  </span>
                </td>
                <td className="p-3 text-slate-600 dark:text-slate-400">{rule.from}</td>
                <td className="p-3 text-right">
                  <button 
                    onClick={() => handleDelete(rule.id)}
                    className="text-slate-400 hover:text-red-600 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
            {rules.length === 0 && (
              <tr>
                <td colSpan={5} className="p-4 text-center text-slate-400">No rules found or firewall inactive.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
