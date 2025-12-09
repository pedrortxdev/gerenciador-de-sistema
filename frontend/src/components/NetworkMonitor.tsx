import { NetworkInfo } from '@/types/api';
import { formatBytes } from '@/utils/format';
import { Globe, Network, Activity, ArrowUp, ArrowDown } from 'lucide-react';

export default function NetworkMonitor({ data }: { data: NetworkInfo | null }) {
  if (!data) return null;

  const { interfaces, stats, public_ip } = data;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
      {/* Traffic Stats */}
      <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-md border border-slate-200 dark:border-slate-700">
        <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
          <Activity className="w-5 h-5 text-orange-500" /> Network Traffic (Total)
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-lg flex flex-col items-center justify-center">
             <div className="flex items-center gap-2 text-slate-500 mb-2">
                <ArrowUp className="w-4 h-4" /> Upload
             </div>
             <span className="text-xl font-bold text-slate-800 dark:text-white">{formatBytes(stats.bytes_sent)}</span>
          </div>
          <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-lg flex flex-col items-center justify-center">
             <div className="flex items-center gap-2 text-slate-500 mb-2">
                <ArrowDown className="w-4 h-4" /> Download
             </div>
             <span className="text-xl font-bold text-slate-800 dark:text-white">{formatBytes(stats.bytes_recv)}</span>
          </div>
        </div>
        <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800 flex items-center justify-between">
            <span className="flex items-center gap-2 font-medium text-blue-700 dark:text-blue-300">
                <Globe className="w-4 h-4" /> Public IP
            </span>
            <span className="font-mono font-bold text-blue-800 dark:text-blue-200">{public_ip}</span>
        </div>
      </div>

      {/* Interfaces List */}
      <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-md border border-slate-200 dark:border-slate-700 overflow-y-auto max-h-80">
        <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
          <Network className="w-5 h-5 text-cyan-500" /> Interfaces & Local IPs
        </h3>
        <div className="space-y-4">
            {interfaces.map((iface) => (
                <div key={iface.name} className="border-b border-slate-100 dark:border-slate-700 pb-4 last:border-0 last:pb-0">
                    <div className="font-medium text-slate-700 dark:text-slate-200 mb-2 flex items-center justify-between">
                        <span>{iface.name}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500">Interface</span>
                    </div>
                    
                    {iface.ipv4 && iface.ipv4.length > 0 && (
                        <div className="mb-2">
                            <span className="text-xs uppercase font-bold text-slate-400 block mb-1">IPv4</span>
                            {iface.ipv4.map(ip => (
                                <div key={ip} className="font-mono text-sm text-slate-600 dark:text-slate-300 ml-2">{ip}</div>
                            ))}
                        </div>
                    )}

                    {iface.ipv6 && iface.ipv6.length > 0 && (
                        <div>
                            <span className="text-xs uppercase font-bold text-slate-400 block mb-1">IPv6</span>
                            {iface.ipv6.map(ip => (
                                <div key={ip} className="font-mono text-xs text-slate-500 ml-2 break-all">{ip}</div>
                            ))}
                        </div>
                    )}
                </div>
            ))}
        </div>
      </div>
    </div>
  );
}
