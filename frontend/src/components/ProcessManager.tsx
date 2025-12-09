import { ProcessInfo } from '@/types/api';
import { Trash2, Search, ShieldAlert, RefreshCw } from 'lucide-react';
import { useState, useMemo } from 'react';
import axios from 'axios';

const API_URL = '/api'; // Adjust based on env

interface ProcessManagerProps {
  data: ProcessInfo[];
  onRefresh: () => void;
}

export default function ProcessManager({ data, onRefresh }: ProcessManagerProps) {
  const [filter, setFilter] = useState('');
  const [killPid, setKillPid] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const filteredProcesses = useMemo(() => {
    return data.filter(p => 
      p.name.toLowerCase().includes(filter.toLowerCase()) || 
      p.pid.toString().includes(filter) ||
      p.port.toString().includes(filter)
    );
  }, [data, filter]);

  const handleKill = async (pid: number) => {
    if (!confirm(`Are you sure you want to KILL process PID ${pid}?`)) return;
    
    setLoading(true);
    try {
      await axios.post(`${API_URL}/processes/kill`, { pid });
      alert(`Process ${pid} killed successfully.`);
      onRefresh();
    } catch (err) {
      alert('Failed to kill process. Check permissions or PID.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleManualKill = (e: React.FormEvent) => {
    e.preventDefault();
    if (!killPid) return;
    handleKill(parseInt(killPid));
    setKillPid('');
  };

  return (
    <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-md border border-slate-200 dark:border-slate-700 mb-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
        <h3 className="text-lg font-semibold text-slate-800 dark:text-white flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 text-red-500" /> Port & Process Manager
        </h3>
        
        <form onSubmit={handleManualKill} className="flex gap-2">
          <input
            type="number"
            placeholder="PID to Kill"
            className="px-3 py-2 border rounded-lg text-sm bg-slate-50 dark:bg-slate-900 dark:border-slate-600 dark:text-white"
            value={killPid}
            onChange={(e) => setKillPid(e.target.value)}
          />
          <button 
            type="submit"
            disabled={loading || !killPid}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            Kill
          </button>
        </form>
      </div>

      <div className="mb-4 relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
        <input 
          type="text" 
          placeholder="Filter by Name, PID or Port..." 
          className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm bg-slate-50 dark:bg-slate-900 dark:border-slate-600 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700">
              <th className="p-3 text-xs font-bold uppercase text-slate-500 dark:text-slate-400">PID</th>
              <th className="p-3 text-xs font-bold uppercase text-slate-500 dark:text-slate-400">Name</th>
              <th className="p-3 text-xs font-bold uppercase text-slate-500 dark:text-slate-400">Port</th>
              <th className="p-3 text-xs font-bold uppercase text-slate-500 dark:text-slate-400">Protocol</th>
              <th className="p-3 text-xs font-bold uppercase text-slate-500 dark:text-slate-400 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredProcesses.length === 0 ? (
               <tr>
                 <td colSpan={5} className="p-4 text-center text-slate-500">No matching processes found.</td>
               </tr>
            ) : (
              filteredProcesses.map((proc) => (
                <tr key={`${proc.pid}-${proc.port}`} className="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors">
                  <td className="p-3 font-mono text-sm text-slate-600 dark:text-slate-300">{proc.pid}</td>
                  <td className="p-3 font-medium text-slate-800 dark:text-white">{proc.name}</td>
                  <td className="p-3 font-mono text-sm text-blue-600 dark:text-blue-400">{proc.port}</td>
                  <td className="p-3 text-sm text-slate-500 uppercase">{proc.protocol}</td>
                  <td className="p-3 text-right">
                    <button 
                      onClick={() => handleKill(proc.pid)}
                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"
                      title="Kill Process"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      
      <div className="mt-4 text-xs text-slate-400 text-right">
        Showing {filteredProcesses.length} of {data.length} active listeners
      </div>
    </div>
  );
}
