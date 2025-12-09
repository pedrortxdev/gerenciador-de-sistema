import { useState } from 'react';
import axios from 'axios';
import { Globe, Server, Shield, Loader2, AlertCircle, CheckCircle, Terminal } from 'lucide-react';

const API_URL = '/api';

export default function SiteWizard() {
  const [domain, setDomain] = useState('');
  const [type, setType] = useState<'proxy' | 'static'>('proxy');
  const [target, setTarget] = useState('');
  const [ssl, setSsl] = useState(false);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'warning' | 'error', msg: string, details?: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!domain || !target) return;

    setLoading(true);
    setStatus(null);

    try {
      const res = await axios.post(`${API_URL}/nginx/create-site`, {
        domain,
        type,
        target,
        ssl
      });

      if (res.data.status === 'warning') {
        setStatus({ type: 'warning', msg: res.data.message, details: res.data.details });
      } else {
        setStatus({ type: 'success', msg: res.data.message, details: res.data.ssl_output });
        // Reset form on success
        setDomain('');
        setTarget('');
        setSsl(false);
      }
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Failed to deploy site.';
      const details = err.response?.data?.details || '';
      setStatus({ type: 'error', msg, details });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="bg-white dark:bg-slate-800 p-8 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-3 mb-6 border-b border-slate-100 dark:border-slate-700 pb-4">
          <div className="bg-gradient-to-r from-blue-500 to-cyan-500 p-3 rounded-lg">
            <Globe className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Site Wizard</h2>
            <p className="text-slate-500 dark:text-slate-400">Deploy new sites and configure SSL automatically.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Domain Input */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Domain Name</label>
            <div className="relative">
              <input
                type="text"
                placeholder="app.example.com"
                className="w-full pl-4 pr-4 py-3 border rounded-lg bg-slate-50 dark:bg-slate-900 dark:border-slate-600 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                required
              />
            </div>
            <p className="text-xs text-slate-400 mt-1">DNS must verify to this server's IP before enabling SSL.</p>
          </div>

          {/* Type Selection */}
          <div className="grid grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => setType('proxy')}
              className={`p-4 border rounded-xl flex flex-col items-center gap-2 transition-all ${
                type === 'proxy'
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-300'
                  : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750 text-slate-600'
              }`}
            >
              <Server className="w-6 h-6" />
              <span className="font-semibold">Reverse Proxy</span>
              <span className="text-xs opacity-75">Forward to localhost port</span>
            </button>

            <button
              type="button"
              onClick={() => setType('static')}
              className={`p-4 border rounded-xl flex flex-col items-center gap-2 transition-all ${
                type === 'static'
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-300'
                  : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750 text-slate-600'
              }`}
            >
              <Globe className="w-6 h-6" />
              <span className="font-semibold">Static Site</span>
              <span className="text-xs opacity-75">Serve HTML files</span>
            </button>
          </div>

          {/* Conditional Target Input */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {type === 'proxy' ? 'Local Port' : 'Web Root Path'}
            </label>
            <input
              type="text"
              placeholder={type === 'proxy' ? "3000" : "/var/www/html/mysite"}
              className="w-full px-4 py-3 border rounded-lg bg-slate-50 dark:bg-slate-900 dark:border-slate-600 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none font-mono"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              required
            />
          </div>

          {/* SSL Checkbox */}
          <div className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-700">
            <div className="flex items-center h-5">
              <input
                id="ssl-check"
                type="checkbox"
                className="w-5 h-5 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                checked={ssl}
                onChange={(e) => setSsl(e.target.checked)}
              />
            </div>
            <div className="ml-2 text-sm">
              <label htmlFor="ssl-check" className="font-medium text-slate-800 dark:text-white flex items-center gap-2">
                <Shield className="w-4 h-4 text-green-500" /> Enable HTTPS (SSL) via Certbot
              </label>
              <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">
                Automatically requests a Let's Encrypt certificate. This process may take up to 30 seconds.
              </p>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" /> Deploying...
              </>
            ) : (
              "Deploy Site"
            )}
          </button>
        </form>

        {/* Status Output */}
        {status && (
          <div className={`mt-6 p-4 rounded-lg border ${
            status.type === 'error' 
              ? 'bg-red-50 border-red-200 text-red-800 dark:bg-red-900/20 dark:border-red-800 dark:text-red-300' 
              : status.type === 'warning'
              ? 'bg-yellow-50 border-yellow-200 text-yellow-800 dark:bg-yellow-900/20 dark:border-yellow-800 dark:text-yellow-300'
              : 'bg-green-50 border-green-200 text-green-800 dark:bg-green-900/20 dark:border-green-800 dark:text-green-300'
          }`}>
            <div className="flex items-start gap-3">
              {status.type === 'error' && <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />}
              {status.type === 'warning' && <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />}
              {status.type === 'success' && <CheckCircle className="w-5 h-5 mt-0.5 shrink-0" />}
              <div className="flex-1 overflow-hidden">
                <h3 className="font-bold text-sm">{status.msg}</h3>
                {status.details && (
                  <div className="mt-2 bg-black/5 dark:bg-black/30 rounded p-2">
                     <div className="flex items-center gap-1 text-xs font-mono opacity-50 mb-1">
                        <Terminal className="w-3 h-3" /> Output Log
                     </div>
                     <pre className="text-xs font-mono whitespace-pre-wrap break-all max-h-40 overflow-y-auto">
                       {status.details}
                     </pre>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
