'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';
import Cookies from 'js-cookie';
import SystemMonitor from '@/components/SystemMonitor';
import NetworkMonitor from '@/components/NetworkMonitor';
import ProcessManager from '@/components/ProcessManager';
import NginxEditor from '@/components/NginxEditor';
import SiteWizard from '@/components/SiteWizard';
import DNSManager from '@/components/DNSManager';
import LoginModal from '@/components/LoginModal';
import DatabaseManager from '@/components/DatabaseManager';
import { SystemInfo, NetworkInfo, ProcessInfo } from '@/types/api';
import { LayoutDashboard, Wand2, Cloud, Database } from 'lucide-react';

const API_URL = '/api';

export default function Home() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  const [systemData, setSystemData] = useState<SystemInfo | null>(null);
  const [networkData, setNetworkData] = useState<NetworkInfo | null>(null);
  const [processData, setProcessData] = useState<ProcessInfo[]>([]);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [activeTab, setActiveTab] = useState<'dashboard' | 'nginx' | 'wizard' | 'dns' | 'database'>('dashboard');

  useEffect(() => {
    const token = Cookies.get('auth_token');
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      setIsAuthenticated(true);
    }
    setIsCheckingAuth(false);
  }, []);

  const fetchData = async () => {
    try {
      const [sysRes, netRes, procRes] = await Promise.all([
        axios.get(`${API_URL}/system`),
        axios.get(`${API_URL}/network`),
        axios.get(`${API_URL}/processes`)
      ]);
      setSystemData(sysRes.data);
      setNetworkData(netRes.data);
      setProcessData(procRes.data);
      setLastUpdate(new Date());
    } catch (error) {
      console.error("Error fetching data:", error);
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        setIsAuthenticated(false);
        Cookies.remove('auth_token');
      }
    }
  };

  useEffect(() => {
    if (!isAuthenticated) return;
    
    fetchData();
    const interval = setInterval(fetchData, 2000); // 2s poll
    return () => clearInterval(interval);
  }, [isAuthenticated]);

  if (isCheckingAuth) {
    return <div className="min-h-screen bg-slate-100 dark:bg-slate-950 flex items-center justify-center">
      <div className="text-slate-500">Loading...</div>
    </div>;
  }

  if (!isAuthenticated) {
    return <LoginModal onLoginSuccess={() => setIsAuthenticated(true)} />;
  }

  return (
    <main className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans">
      {/* Header */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
             <div className="bg-blue-600 p-2 rounded-lg">
                <LayoutDashboard className="w-6 h-6 text-white" />
             </div>
             <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-cyan-500">
               System Manager
             </h1>
          </div>
          
          <div className="flex items-center gap-4">
            <span className="text-xs text-slate-500 hidden sm:block">
               Last update: {lastUpdate.toLocaleTimeString()}
            </span>
            <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
               <button 
                 onClick={() => setActiveTab('dashboard')}
                 className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                    activeTab === 'dashboard' 
                    ? 'bg-white dark:bg-slate-700 shadow text-blue-600 dark:text-blue-400' 
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                 }`}
               >
                 Monitor
               </button>
               <button 
                 onClick={() => setActiveTab('nginx')}
                 className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                    activeTab === 'nginx' 
                    ? 'bg-white dark:bg-slate-700 shadow text-blue-600 dark:text-blue-400' 
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                 }`}
               >
                 Nginx Config
               </button>
               <button 
                 onClick={() => setActiveTab('wizard')}
                 className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${
                    activeTab === 'wizard' 
                    ? 'bg-white dark:bg-slate-700 shadow text-blue-600 dark:text-blue-400' 
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                 }`}
               >
                 <Wand2 className="w-4 h-4" /> Site Wizard
               </button>
               <button 
                 onClick={() => setActiveTab('dns')}
                 className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${
                    activeTab === 'dns' 
                    ? 'bg-white dark:bg-slate-700 shadow text-blue-600 dark:text-blue-400' 
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                 }`}
               >
                 <Cloud className="w-4 h-4" /> DNS
               </button>
               <button 
                 onClick={() => setActiveTab('database')}
                 className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${
                    activeTab === 'database' 
                    ? 'bg-white dark:bg-slate-700 shadow text-blue-600 dark:text-blue-400' 
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                 }`}
               >
                 <Database className="w-4 h-4" /> Databases
               </button>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 h-[calc(100vh-4rem)] overflow-hidden"> {/* Adjusted height to fill remaining screen, hidden overflow */}
        <div style={{ display: activeTab === 'dashboard' ? 'block' : 'none' }} className="h-full">
          <div className="space-y-6 animate-in fade-in duration-500 h-full overflow-y-auto"> {/* Added h-full and overflow-y-auto */}
            <SystemMonitor data={systemData} />
            <NetworkMonitor data={networkData} />
            <ProcessManager data={processData} onRefresh={fetchData} />
          </div>
        </div>
        
        <div style={{ display: activeTab === 'nginx' ? 'block' : 'none' }} className="h-full">
          <div className="animate-in fade-in duration-500 h-full flex flex-col"> {/* Added h-full and flex flex-col */}
             <div className="mb-6">
                <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">Nginx Configuration Manager</h2>
                <p className="text-slate-500 dark:text-slate-400">
                   Edit site configurations safely. Changes are validated with 'nginx -t' before being applied.
                </p>
             </div>
             <div className="flex-1 overflow-hidden"> {/* Added flex-1 and overflow-hidden */}
               <NginxEditor />
             </div>
          </div>
        </div>

        <div style={{ display: activeTab === 'wizard' ? 'block' : 'none' }} className="h-full">
          <div className="animate-in fade-in duration-500 h-full overflow-y-auto"> {/* Added h-full and overflow-y-auto */}
             <SiteWizard />
          </div>
        </div>

        <div style={{ display: activeTab === 'dns' ? 'block' : 'none' }} className="h-full">
          <div className="animate-in fade-in duration-500 h-full overflow-y-auto"> {/* Added h-full and overflow-y-auto */}
             <DNSManager />
          </div>
        </div>

        <div style={{ display: activeTab === 'database' ? 'block' : 'none' }} className="h-full">
          <div className="animate-in fade-in duration-500 h-full"> {/* Added h-full */}
             <DatabaseManager />
          </div>
        </div>
      </div>
    </main>
  );
}
