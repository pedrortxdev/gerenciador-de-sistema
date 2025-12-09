import { useState } from 'react';
import axios from 'axios';
import Cookies from 'js-cookie';
import { Lock } from 'lucide-react';

const API_URL = '/api';

interface LoginModalProps {
  onLoginSuccess: () => void;
}

export default function LoginModal({ onLoginSuccess }: LoginModalProps) {
  const [username, setUsername] = useState('root');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await axios.post(`${API_URL}/login`, { username, password });
      const token = res.data.token;
      
      // Save token
      Cookies.set('auth_token', token, { expires: 1 }); // 1 day
      
      // Set global axios header
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      
      onLoginSuccess();
    } catch (err: any) {
      console.error(err);
      setError('Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-2xl max-w-md w-full border border-slate-200 dark:border-slate-700">
        <div className="flex flex-col items-center mb-6">
          <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mb-4">
            <Lock className="w-8 h-8 text-blue-600 dark:text-blue-400" />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white">System Access</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Please login with your system credentials</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="root"
            />
          </div>
          
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className="text-red-500 text-sm text-center bg-red-50 dark:bg-red-900/20 p-2 rounded">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg transition-colors disabled:opacity-50"
          >
            {loading ? 'Authenticating...' : 'Login'}
          </button>
        </form>
      </div>
    </div>
  );
}
