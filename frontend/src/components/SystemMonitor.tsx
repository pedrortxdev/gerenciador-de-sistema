import { SystemInfo } from '@/types/api';
import { formatBytes } from '@/utils/format';
import { Cpu, HardDrive, Server } from 'lucide-react';
import { useState } from 'react';

interface ProgressBarProps {
  percent: number;
  colorClass?: string;
}

const ProgressBar = ({ percent, colorClass = "bg-blue-600" }: ProgressBarProps) => (
  <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700 mt-2">
    <div 
      className={`h-2.5 rounded-full transition-all duration-500 ${colorClass}`} 
      style={{ width: `${Math.min(percent, 100)}%` }}
    ></div>
  </div>
);

export default function SystemMonitor({ data }: { data: SystemInfo | null }) {
  const [showCores, setShowCores] = useState(false);

  if (!data) return (
    <div className="p-6 bg-white rounded-xl shadow-md animate-pulse h-64 flex items-center justify-center text-gray-400">
      Connecting to System Agent...
    </div>
  );

  const { cpu, ram, disk } = data;

  // Determine colors based on usage
  const getUsageColor = (usage: number) => {
    if (usage > 90) return "bg-red-600";
    if (usage > 70) return "bg-yellow-500";
    return "bg-blue-600";
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
      {/* CPU Card */}
      <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-md border border-slate-200 dark:border-slate-700">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-800 dark:text-white flex items-center gap-2">
            <Cpu className="w-5 h-5 text-blue-500" /> CPU
          </h3>
          <span className="text-xs font-mono bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded text-slate-600 dark:text-slate-300">
            {cpu.cores}C / {cpu.threads}T
          </span>
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-2 truncate" title={cpu.model_name}>
          {cpu.model_name}
        </p>
        <div className="flex justify-between items-end mb-1">
          <span className="text-2xl font-bold text-slate-800 dark:text-white">{cpu.usage.toFixed(1)}%</span>
        </div>
        <ProgressBar percent={cpu.usage} colorClass={getUsageColor(cpu.usage)} />

        <button 
          onClick={() => setShowCores(!showCores)}
          className="mt-4 text-xs text-blue-500 hover:underline w-full text-right"
        >
          {showCores ? "Hide Cores" : "Show Per Core"}
        </button>

        {showCores && (
          <div className="grid grid-cols-4 gap-2 mt-4">
            {cpu.usage_per_core.map((usage, idx) => (
              <div key={idx} className="flex flex-col items-center">
                <div className="h-12 w-2 bg-gray-200 dark:bg-gray-700 rounded-full relative overflow-hidden">
                  <div 
                    className={`absolute bottom-0 w-full rounded-full transition-all duration-300 ${getUsageColor(usage)}`}
                    style={{ height: `${usage}%` }}
                  />
                </div>
                <span className="text-[10px] mt-1 text-slate-400">#{idx}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* RAM Card */}
      <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-md border border-slate-200 dark:border-slate-700">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-800 dark:text-white flex items-center gap-2">
            <Server className="w-5 h-5 text-purple-500" /> RAM
          </h3>
        </div>
        <div className="flex justify-between items-end mb-1">
          <span className="text-2xl font-bold text-slate-800 dark:text-white">{ram.used_percent.toFixed(1)}%</span>
          <span className="text-sm text-slate-500">{formatBytes(ram.used)} / {formatBytes(ram.total)}</span>
        </div>
        <ProgressBar percent={ram.used_percent} colorClass={getUsageColor(ram.used_percent)} />
      </div>

      {/* Disk Card */}
      <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-md border border-slate-200 dark:border-slate-700">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-800 dark:text-white flex items-center gap-2">
            <HardDrive className="w-5 h-5 text-green-500" /> Storage
          </h3>
          <span className="text-xs font-mono bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded text-slate-600 dark:text-slate-300">
            / (Root)
          </span>
        </div>
        <div className="flex justify-between items-end mb-1">
          <span className="text-2xl font-bold text-slate-800 dark:text-white">{disk.used_percent.toFixed(1)}%</span>
          <span className="text-sm text-slate-500">{formatBytes(disk.used)} / {formatBytes(disk.total)}</span>
        </div>
        <ProgressBar percent={disk.used_percent} colorClass={getUsageColor(disk.used_percent)} />
      </div>
    </div>
  );
}
