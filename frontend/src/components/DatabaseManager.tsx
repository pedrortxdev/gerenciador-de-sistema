"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import Editor from '@monaco-editor/react'; // Import Monaco Editor
import { 
  Database, Server, Play, StopCircle, RefreshCw, 
  Terminal, Table as TableIcon, ShieldAlert, CheckCircle2, XCircle, Key, History as HistoryIcon, RotateCcw // Added RotateCcw
} from 'lucide-react';

// --- Types ---

type DBType = 'postgres' | 'redis' | 'mysql'; // Added mysql for future proofing

interface QueryResult {
  columns: string[];
  rows: Record<string, any>[];
  message?: string;
}

interface ServiceStatus {
  [key: string]: 'active' | 'inactive' | 'unknown';
}

interface SchemaEntry {
  name: string;
  type: string; // e.g., "table", "string", "hash", "list"
}

// --- Components ---

export default function DatabaseManager() {
  const [activeTab, setActiveTab] = useState<'status' | 'manager'>('status');
  const [connection, setConnection] = useState({
    type: 'postgres' as DBType,
    host: 'localhost',
    port: '5432',
    user: 'postgres',
    password: '',
    database: 'postgres'
  });
  const [isConnected, setIsConnected] = useState(false);
  const [statuses, setStatuses] = useState<ServiceStatus>({});
  const [loadingStatuses, setLoadingStatuses] = useState(true);

  const fetchStatus = useCallback(async () => {
    setLoadingStatuses(true);
    try {
      const res = await axios.get('/api/databases/status');
      setStatuses(res.data);
    } catch (err) {
      console.error("Error fetching database service statuses:", err);
    } finally {
      setLoadingStatuses(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 5000); // Poll status every 5 seconds
    return () => clearInterval(interval);
  }, [fetchStatus]);

  return (
    <div className="space-y-6 h-full flex flex-col"> {/* Added flex-col h-full */}
      {/* Top Navigation */}
      <div className="flex space-x-4 border-b border-slate-200 dark:border-slate-700 pb-2">
        <button
          onClick={() => setActiveTab('status')}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            activeTab === 'status' 
              ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' 
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          Service Status
        </button>
        <button
          onClick={() => setActiveTab('manager')}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            activeTab === 'manager' 
              ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' 
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          Query Manager
        </button>
      </div>

      {activeTab === 'status' && <StatusDashboard statuses={statuses} fetchStatus={fetchStatus} loading={loadingStatuses} />}
      
      {activeTab === 'manager' && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 flex-1"> {/* Added flex-1 */}
          {/* Sidebar: Connection */}
          <div className="lg:col-span-1 space-y-6 flex flex-col"> {/* Added flex flex-col */}
             <ConnectionPanel 
               config={connection} 
               setConfig={setConnection} 
               isConnected={isConnected}
               onConnect={() => setIsConnected(true)}
               onDisconnect={() => setIsConnected(false)}
               statuses={statuses} // Pass statuses down
             />
          </div>

          {/* Main Area: Manager */}
          <div className="lg:col-span-3 flex-1 flex flex-col"> {/* Added flex-1 flex flex-col */}
            {isConnected ? (
              <QueryInterface config={connection} />
            ) : (
              <div className="h-full min-h-[400px] flex flex-col items-center justify-center bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500">
                <Database className="w-16 h-16 mb-4 opacity-20" />
                <p>Connect to a database to start managing</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// --- Sub-Components ---

function StatusDashboard({ statuses, fetchStatus, loading }: { statuses: ServiceStatus; fetchStatus: () => void; loading: boolean }) {
  const services = [
    { id: 'postgresql', name: 'PostgreSQL', icon: Database, color: 'bg-blue-500' },
    { id: 'redis-server', name: 'Redis', icon: Server, color: 'bg-red-500' },
    { id: 'mysql', name: 'MySQL', icon: Database, color: 'bg-orange-500' },
    { id: 'mariadb', name: 'MariaDB', icon: Database, color: 'bg-yellow-600' }, // MariaDB service will be grouped with MySQL
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 relative">
      {services.map(svc => {
        // Map postgresql and redis-server to the IDs used in backend's handleDatabaseStatus
        let statusKey = svc.id;
        if (svc.id === 'mariadb') statusKey = 'mysql'; // Group mariadb under mysql status check

        const status = statuses[statusKey] || 'unknown';
        const isActive = status === 'active';
        const Icon = svc.icon;

        return (
          <div key={svc.id} className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 relative overflow-hidden">
            <div className={`absolute top-0 right-0 p-2 ${isActive ? 'text-green-500' : 'text-slate-300'}`}>
              {isActive ? <CheckCircle2 className="w-6 h-6" /> : <StopCircle className="w-6 h-6" />}
            </div>

            <div className="flex items-center space-x-4 mb-4">
              <div className={`p-3 rounded-lg ${svc.color} text-white`}>
                <Icon className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-slate-800 dark:text-white">{svc.name}</h3>
                <span className={`text-xs uppercase font-bold ${isActive ? 'text-green-600' : 'text-slate-500'}`}>
                    {status}
                  </span>
              </div>
            </div>

            <div className="flex space-x-2 mt-4">
                 {/* Action buttons could call systemctl via process API if implemented, 
                     for now visual placeholders or simple indicators */}
                 <button 
                   disabled 
                   className="flex-1 py-1 text-xs bg-slate-100 dark:bg-slate-700 rounded opacity-50 cursor-not-allowed"
                 >
                   Managed by Systemd
                 </button>
              </div>
          </div>
        );
      })}
       <button 
        onClick={fetchStatus}
        className="absolute top-4 right-4 p-2 text-slate-500 hover:text-blue-600 bg-white dark:bg-slate-800 rounded-full shadow-sm border border-slate-200 dark:border-slate-700"
      >
        <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
      </button>
    </div>
  );
}

function ConnectionPanel({ config, setConfig, isConnected, onConnect, onDisconnect, statuses }: any) {
  const handleChange = (field: string, value: string) => {
    setConfig({ ...config, [field]: value });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isConnected) {
      onDisconnect();
    } else {
      onConnect();
    }
  };

  const getServiceStatus = (dbType: DBType) => {
    if (dbType === 'postgres') return statuses['postgresql'];
    if (dbType === 'redis') return statuses['redis-server'];
    if (dbType === 'mysql') return statuses['mysql']; // Covers both mysql and mariadb backend check
    return 'unknown';
  };

  const currentServiceStatus = getServiceStatus(config.type);
  const isServiceInactive = currentServiceStatus === 'inactive';

  return (
    <div className="bg-white dark:bg-slate-800 p-5 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700">
      <h3 className="font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
        <Server className="w-4 h-4" /> Connection
      </h3>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Type</label>
          <select
            value={config.type}
            onChange={(e) => handleChange('type', e.target.value)}
            disabled={isConnected}
            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded p-2 text-sm"
          >
            <option value="postgres">PostgreSQL</option>
            <option value="redis">Redis</option>
            {/* <option value="mysql">MySQL</option> future */}
          </select>
        </div>

        {isServiceInactive && (
          <div className="bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 p-3 rounded-md text-sm flex items-start gap-2">
            <ShieldAlert className="w-5 h-5 shrink-0" />
            <p>The {config.type === 'postgres' ? 'PostgreSQL' : config.type === 'redis' ? 'Redis' : 'Database'} service appears to be stopped. Try starting it first.</p>
          </div>
        )}

        <div className="grid grid-cols-3 gap-2">
          <div className="col-span-2">
            <label className="block text-xs font-medium text-slate-500 mb-1">Host</label>
            <input
              type="text"
              value={config.host}
              onChange={(e) => handleChange('host', e.target.value)}
              disabled={isConnected}
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded p-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Port</label>
            <input
              type="text"
              value={config.port}
              onChange={(e) => handleChange('port', e.target.value)}
              disabled={isConnected}
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded p-2 text-sm"
            />
          </div>
        </div>

        {config.type === 'postgres' && (
            <>
                <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Database</label>
                <input
                    type="text"
                    value={config.database}
                    onChange={(e) => handleChange('database', e.target.value)}
                    disabled={isConnected}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded p-2 text-sm"
                />
                </div>
                <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">User</label>
                <input
                    type="text"
                    value={config.user}
                    onChange={(e) => handleChange('user', e.target.value)}
                    disabled={isConnected}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded p-2 text-sm"
                />
                </div>
            </>
        )}

        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Password</label>
          <input
            type="password"
            value={config.password}
            onChange={(e) => handleChange('password', e.target.value)}
            disabled={isConnected}
            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded p-2 text-sm"
          />
        </div>

        <button
          type="submit"
          className={`w-full py-2 rounded-md text-sm font-bold transition-colors ${
            isConnected 
              ? 'bg-red-100 text-red-600 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400' 
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
        >
          {isConnected ? 'Disconnect' : 'Connect'}
        </button>
      </form>
    </div>
  );
}

function ConfirmationModal({ query, onConfirm, onClose }: { query: string; onConfirm: () => void; onClose: () => void }) {
  const [countdown, setCountdown] = useState(3);
  const [canConfirm, setCanConfirm] = useState(false);

  useEffect(() => {
    setCountdown(3); // Reset countdown when modal opens
    setCanConfirm(false);
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          setCanConfirm(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [query]); // Reset timer if query changes while modal is open

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-slate-800 p-6 rounded-lg shadow-xl border border-slate-700 w-96">
        <h3 className="text-xl font-bold text-red-400 mb-4">Dangerous Query Detected!</h3>
        <p className="text-slate-300 mb-4">
          The following query contains potentially destructive commands. Please review carefully.
        </p>
        <pre className="bg-slate-900 text-red-300 p-3 rounded-md overflow-x-auto text-sm mb-4">
          {query}
        </pre>
        <p className="text-slate-400 text-sm mb-4">
          This action cannot be undone. You must wait {countdown} seconds to confirm.
        </p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-md text-slate-200 text-sm"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={!canConfirm}
            className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${
              canConfirm
                ? 'bg-red-600 hover:bg-red-700 text-white'
                : 'bg-red-900/50 text-red-300 cursor-not-allowed'
            }`}
          >
            {canConfirm ? 'Confirm Execution' : `Confirm (${countdown}s)`}
          </button>
        </div>
      </div>
    </div>
  );
}

function QueryInterface({ config }: any) {
  const [activeSubTab, setActiveSubTab] = useState<'results' | 'history' | 'sql_editor'>('sql_editor'); // Default to SQL Editor
  const [schemaEntries, setSchemaEntries] = useState<SchemaEntry[]>([]);
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<QueryResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const lastFetchedConfigRef = useRef<string | null>(null);

  const [queryHistory, setQueryHistory] = useState<string[]>([]);
  const [contextMenu, setContextMenu] = useState<{ visible: boolean; x: number; y: number; entry: SchemaEntry | null } | null>(null);
  const [queryStatus, setQueryStatus] = useState<{ time: string; rows: number | null; duration: number | null } | null>(null);

  // State for the confirmation modal
  const [confirmationModal, setConfirmationModal] = useState<{ query: string; onConfirm: () => void; } | null>(null);

  const editorLanguage = config.type === 'postgres' || config.type === 'mysql' ? 'sql' : 'plaintext';

  const getConnStr = useCallback(() => {
    if (config.type === 'postgres') {
      return `host=${config.host} port=${config.port} user=${config.user} password=${config.password} dbname=${config.database} sslmode=disable`;
    } else {
      if (config.password) {
        return `redis://:${config.password}@${config.host}:${config.port}/0`;
      }
      return `${config.host}:${config.port}`;
    }
  }, [config.type, config.user, config.password, config.host, config.port, config.database]);

  const fetchSchema = useCallback(async () => {
    const currentConfigSignature = JSON.stringify({
      type: config.type,
      host: config.host,
      port: config.port,
      user: config.user,
      database: config.database,
      password: config.password,
    }) + getConnStr();

    if (lastFetchedConfigRef.current === currentConfigSignature) {
        return;
    }

    setLoading(true);
    setError('');
    try {
      const res = await axios.post('/api/databases/schema', {
        type: config.type,
        connection_string: getConnStr(),
      });
      setSchemaEntries(res.data.entries || []);
      lastFetchedConfigRef.current = currentConfigSignature;
    } catch (err: any) {
      console.error("Error fetching schema:", err);
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  }, [config.type, config.host, config.port, config.user, config.password, config.database, getConnStr]);

  // Renamed internal execute to _execute to differentiate from public handleRunQuery
  const _execute = async (q: string, target?: string, isContextMenuAction = false) => {
    setLoading(true);
    setError('');
    setResult(null);
    setQueryStatus(null);
    const startTime = Date.now();

    try {
      const payload: { type: string; connection_string: string; query: string; query_target?: string } = {
        type: config.type,
        connection_string: getConnStr(),
        query: q
      };
      if (target) {
        payload.query_target = target;
      }

      const res = await axios.post('/api/databases/query', payload);
      setResult(res.data);

      if (!isContextMenuAction) {
        setQueryHistory(prevHistory => {
            // Prevent adding consecutive duplicates
            if (prevHistory.length > 0 && prevHistory[0] === q) {
              return prevHistory;
            }
            const newHistory = [q, ...prevHistory.filter(item => item !== q)];
            return newHistory.slice(0, 20);
        });
      }

      const endTime = Date.now();
      const duration = endTime - startTime;
      setQueryStatus({
          time: new Date().toLocaleTimeString(),
          rows: res.data.rows ? res.data.rows.length : null,
          duration: duration,
      });

    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.error || err.message);
      setQueryStatus(null);
    } finally {
      setLoading(false);
    }
  };

  // New function for handling query execution with safety check
  const handleRunQuery = (q: string) => {
    const dangerousKeywords = ['DROP', 'DELETE FROM', 'TRUNCATE TABLE', 'ALTER TABLE']; // Case insensitive for comparison
    const lowerCaseQuery = q.toLowerCase();
    
    const isDangerous = dangerousKeywords.some(keyword => lowerCaseQuery.includes(keyword.toLowerCase()));

    if (isDangerous) {
      setConfirmationModal({
        query: q,
        onConfirm: () => {
          setConfirmationModal(null); // Close modal
          _execute(q); // Execute after confirmation
        }
      });
    } else {
      _execute(q); // Execute directly if not dangerous
    }
  };

  useEffect(() => {
    fetchSchema();
  }, [fetchSchema]);

  const handleItemClick = (entry: SchemaEntry) => {
    let inferredQuery = '';
    if (config.type === 'postgres') {
        inferredQuery = `SELECT * FROM "${entry.name}" LIMIT 50`;
    } else {
        switch(entry.type) {
          case 'string': inferredQuery = `GET ${entry.name}`; break;
          case 'hash': inferredQuery = `HGETALL ${entry.name}`; break;
          case 'list': inferredQuery = `LRANGE ${entry.name} 0 -1`; break;
          case 'set': inferredQuery = `SMEMBERS ${entry.name}`; break;
          case 'zset': inferredQuery = `ZRANGE ${entry.name} 0 -1 WITHSCORES`; break;
          default: inferredQuery = `${entry.type.toUpperCase()} ${entry.name}`; break;
        }
    }
    setQuery(inferredQuery);
    _execute("EXPLORE_TABLE", entry.name); // Send EXPLORE_TABLE command to backend
    setActiveSubTab('results'); // Switch to view results
  };

  const handleContextMenu = (e: React.MouseEvent, entry: SchemaEntry) => {
    e.preventDefault();
    setContextMenu({ visible: true, x: e.clientX, y: e.clientY, entry });
  };

  const closeContextMenu = () => {
    setContextMenu(null);
  };

  const handleContextAction = (action: 'select_100' | 'count_rows' | 'drop_table') => {
    if (!contextMenu?.entry) return;

    const entryName = contextMenu.entry.name;
    let actionQuery = '';

    if (config.type === 'postgres') {
        const quotedEntryName = `"${entryName}"`; // Properly quote table names
        switch (action) {
            case 'select_100': actionQuery = `SELECT * FROM ${quotedEntryName} LIMIT 100;`; break;
            case 'count_rows': actionQuery = `SELECT COUNT(*) FROM ${quotedEntryName};`; break;
            case 'drop_table': actionQuery = `DROP TABLE ${quotedEntryName};`; break;
        }
    } else if (config.type === 'redis') {
        switch (action) {
            case 'select_100': actionQuery = `GET ${entryName}`; break; // For Redis, 'select 100' usually means getting the value
            case 'count_rows': actionQuery = `LLEN ${entryName}`; break; // Placeholder, type specific counting needed
            case 'drop_table': actionQuery = `DEL ${entryName}`; break;
        }
    }
    
    setQuery(actionQuery);
    // For 'DROP TABLE'/'DEL Key', it should go through the safety check
    if (action === 'drop_table') {
        handleRunQuery(actionQuery);
    } else {
        _execute(actionQuery, undefined, true); // Execute directly, but don't add to history for context actions
    }
    closeContextMenu();
    setActiveSubTab('sql_editor'); // Switch to SQL editor to show the generated query
  };

  const handleRestoreQuery = useCallback((sql: string) => {
    setQuery(sql);
    setActiveSubTab('sql_editor');
    // Optional: add a toast or visual feedback here
  }, []);

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
      {/* Toolbar */}
      <div className="flex border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
         <div className="w-64 border-r border-slate-200 dark:border-slate-700 p-3 font-bold text-xs uppercase text-slate-500">
            {config.type === 'postgres' ? 'Tables' : 'Keys'}
         </div>
         <div className="flex-1 flex items-center px-4 gap-4">
            <button 
               onClick={() => setActiveSubTab('results')}
               className={`text-sm flex items-center gap-2 py-3 border-b-2 ${activeSubTab === 'results' ? 'border-blue-500 text-blue-600' : 'border-transparent'}`}
            >
               <TableIcon className="w-4 h-4" /> Results
            </button>
            <button 
               onClick={() => setActiveSubTab('history')}
               className={`text-sm flex items-center gap-2 py-3 border-b-2 ${activeSubTab === 'history' ? 'border-blue-500 text-blue-600' : 'border-transparent'}`}
            >
               <HistoryIcon className="w-4 h-4" /> History
            </button>
            <button 
               onClick={() => setActiveSubTab('sql_editor')}
               className={`text-sm flex items-center gap-2 py-3 border-b-2 ${activeSubTab === 'sql_editor' ? 'border-blue-500 text-blue-600' : 'border-transparent'}`}
            >
               <Terminal className="w-4 h-4" /> {config.type === 'postgres' ? 'SQL Editor' : 'Command Console'}
            </button>
         </div>
      </div>

      <div className="flex flex-1"> {/* This flex container will hold sidebar and main content */}
         {/* Sidebar List */}
         <div className="w-64 bg-slate-50 dark:bg-slate-900 border-r border-slate-200 dark:border-slate-700 overflow-y-auto p-2">
            {loading && schemaEntries.length === 0 && <div className="text-xs text-center p-4 text-slate-400">Loading schema...</div>}
            {!loading && schemaEntries.length === 0 && <div className="text-xs text-center p-4 text-slate-400">No items found</div>}
            {schemaEntries.map(entry => (
                <div 
                   key={entry.name} 
                   onClick={() => handleItemClick(entry)}
                   onContextMenu={(e) => handleContextMenu(e, entry)}
                   className="px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 hover:shadow-sm rounded cursor-pointer truncate flex items-center gap-2"
                >
                    {entry.type === 'table' && <TableIcon className="w-4 h-4 text-slate-400" />}
                    {(entry.type === 'string' || entry.type === 'hash' || entry.type === 'list' || entry.type === 'set' || entry.type === 'zset') && <Key className="w-4 h-4 text-slate-400" />}
                    {entry.name}
                </div>
            ))}
         </div>

         {/* Main Content Area (Editor + Results/History + Status Bar) */}
         <div className="flex-1 flex flex-col p-4 overflow-hidden">
            {/* Query Bar (Monaco Editor) */}
            {(activeSubTab === 'sql_editor' || activeSubTab === 'results') && ( // Show editor if on SQL Editor tab or Results tab
                <div className="flex gap-2 mb-4">
                    <Editor
                        height="40vh" // Increased height
                        defaultLanguage={editorLanguage}
                        language={editorLanguage}
                        theme="vs-dark"
                        value={query}
                        onChange={(value) => setQuery(value || '')}
                        options={{
                            minimap: { enabled: false },
                            fontSize: 14,
                            scrollBeyondLastLine: false
                        }}
                    />
                    <button 
                       onClick={() => handleRunQuery(query)} // Changed to handleRunQuery
                       disabled={loading}
                       className="bg-blue-600 hover:bg-blue-700 text-white px-6 rounded-lg font-bold flex items-center gap-2 disabled:opacity-50"
                    >
                        <Play className="w-4 h-4" /> Run
                    </button>
                </div>
            )}

            {/* Results Area / History */}
            <div className="flex-1 flex-col overflow-auto bg-slate-50 dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-700 relative">
                {loading && (
                    <div className="absolute inset-0 bg-white/50 dark:bg-black/50 flex items-center justify-center backdrop-blur-sm z-10">
                        <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
                    </div>
                )}
                
                {error && (
                    <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm flex items-start gap-2">
                        <ShieldAlert className="w-5 h-5 shrink-0" />
                        <pre className="whitespace-pre-wrap font-mono">{error}</pre>
                    </div>
                )}

                {activeSubTab === 'results' && result && result.rows && (
                    <div className="min-w-full inline-block align-middle">
                        <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                            <thead className="bg-slate-100 dark:bg-slate-800 sticky top-0">
                                <tr>
                                    {result.columns.map(col => (
                                        <th key={col} className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap">
                                            {col}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="bg-white dark:bg-slate-900 divide-y divide-slate-200 dark:divide-slate-700">
                                {result.rows.map((row, i) => (
                                    <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                        {result.columns.map(col => (
                                            <td key={col} className="px-4 py-2 whitespace-nowrap text-sm text-slate-700 dark:text-slate-300 font-mono">
                                                {typeof row[col] === 'object' ? JSON.stringify(row[col]) : String(row[col])}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
                
                {activeSubTab === 'results' && result && result.message && !error && (
                    <div className="p-4 text-green-600 dark:text-green-400 text-sm font-medium">
                        {result.message}
                    </div>
                )}

                {activeSubTab === 'history' && (
                  <div className="p-2">
                    {queryHistory.length === 0 && <div className="text-xs text-center p-4 text-slate-400">No queries in history.</div>}
                    {queryHistory.map((histQuery, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between px-3 py-2 mb-1 text-sm text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-white dark:hover:bg-slate-700 hover:shadow-sm rounded cursor-pointer"
                      >
                        <span className="truncate flex-1" title={histQuery}>
                          {histQuery}
                        </span>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation(); // Prevent handleItemClick from firing
                            handleRestoreQuery(histQuery);
                          }}
                          className="ml-2 p-1 rounded-full hover:bg-blue-200 dark:hover:bg-blue-700"
                        >
                          <RotateCcw className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {activeSubTab === 'sql_editor' && !result && !error && (
                    <div className="p-4 text-slate-500 dark:text-slate-400 text-sm">
                        Write your SQL query or Redis command above and click "Run".
                    </div>
                )}
            </div>
             {/* Query Status Bar */}
            {queryStatus && (
              <div className="flex items-center justify-end text-xs text-slate-500 dark:text-slate-400 border-t border-slate-200 dark:border-slate-700 p-2">
                {queryStatus.rows !== null && <span>Rows: {queryStatus.rows} | </span>}
                {queryStatus.duration !== null && <span>Duration: {queryStatus.duration}ms | </span>}
                <span>Last run: {queryStatus.time}</span>
              </div>
            )}
         </div>
      </div>

      {/* Context Menu */}
      {contextMenu && contextMenu.visible && contextMenu.entry && (
          <div
              className="absolute z-50 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded shadow-lg py-1"
              style={{ top: contextMenu.y, left: contextMenu.x }}
              onMouseLeave={closeContextMenu} // Close menu if mouse leaves it
          >
              <button
                  onClick={() => handleContextAction('select_100')}
                  className="block w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-blue-500 hover:text-white"
              >
                  SELECT Top 100
              </button>
              <button
                  onClick={() => handleContextAction('count_rows')}
                  className="block w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-blue-500 hover:text-white"
              >
                  Count Rows
              </button>
              {config.type === 'postgres' && ( // Only show DROP TABLE for Postgres for now
                <button
                    onClick={() => handleContextAction('drop_table')}
                    className="block w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-500 hover:text-white"
                >
                    DROP Table (careful!)
                </button>
              )}
              {config.type === 'redis' && ( // Only show DEL Key for Redis
                <button
                    onClick={() => handleContextAction('drop_table')}
                    className="block w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-500 hover:text-white"
                >
                    DEL Key (careful!)
                </button>
              )}
          </div>
      )}

      {/* Confirmation Modal */}
      {confirmationModal && (
        <ConfirmationModal 
          query={confirmationModal.query}
          onConfirm={confirmationModal.onConfirm}
          onClose={() => setConfirmationModal(null)}
        />
      )}
    </div>
  );
}