import { useState, useEffect } from 'react';
import axios from 'axios';
import { FileText, Save, RotateCcw, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

const API_URL = '/api';

export default function NginxEditor() {
  const [files, setFiles] = useState<string[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [content, setContent] = useState('');
  const [originalContent, setOriginalContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error', msg: string } | null>(null);

  useEffect(() => {
    fetchFiles();
  }, []);

  const fetchFiles = async () => {
    try {
      const res = await axios.get(`${API_URL}/nginx/files`);
      setFiles(res.data);
    } catch (err) {
      console.error("Failed to list nginx files", err);
    }
  };

  const loadFile = async (name: string) => {
    setLoading(true);
    setSelectedFile(name);
    setStatus(null);
    try {
      const res = await axios.get(`${API_URL}/nginx/file?name=${name}`);
      setContent(res.data.content);
      setOriginalContent(res.data.content);
    } catch (err) {
      console.error(err);
      setStatus({ type: 'error', msg: 'Failed to load file content.' });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!selectedFile) return;
    setSaving(true);
    setStatus(null);
    try {
      const res = await axios.post(`${API_URL}/nginx/file`, {
        name: selectedFile,
        content: content
      });
      
      // Backend returns status success or error inside 200 OK sometimes depending on logic, 
      // but we implemented explicit 400 for validation error.
      
      setStatus({ type: 'success', msg: res.data.message });
      setOriginalContent(content);
    } catch (err: any) {
      const msg = err.response?.data?.message || err.response?.data?.error || 'Failed to save.';
      const details = err.response?.data?.details || '';
      setStatus({ type: 'error', msg: msg + (details ? `\n${details}` : '') });
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setContent(originalContent);
    setStatus(null);
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-md border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col md:flex-row h-[600px]">
      {/* Sidebar List */}
      <div className="w-full md:w-1/4 border-r border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 flex flex-col">
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2">
          <FileText className="w-5 h-5" /> Nginx Sites
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {files.map(file => (
            <button
              key={file}
              onClick={() => loadFile(file)}
              className={`w-full text-left px-4 py-3 rounded-lg text-sm transition-colors ${ 
                selectedFile === file 
                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200 font-medium' 
                  : 'hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'
              }`}
            >
              {file}
            </button>
          ))}
        </div>
      </div>

      {/* Editor Area */}
      <div className="flex-1 flex flex-col bg-white dark:bg-slate-800">
        {!selectedFile ? (
          <div className="flex-1 flex items-center justify-center text-slate-400">
            Select a file to edit
          </div>
        ) : (
          <>
            <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
              <h3 className="font-mono font-bold text-slate-700 dark:text-slate-200">{selectedFile}</h3>
              <div className="flex gap-2">
                 <button 
                  onClick={handleCancel}
                  disabled={content === originalContent || saving}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded hover:bg-slate-50 disabled:opacity-50 transition-colors"
                >
                  <RotateCcw className="w-4 h-4" /> Reset
                </button>
                <button 
                  onClick={handleSave}
                  disabled={saving || content === originalContent}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Save & Reload
                </button>
              </div>
            </div>

            {status && (
              <div className={`p-3 text-sm flex items-start gap-2 ${ 
                status.type === 'success' ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-300' : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300' 
              }`}>
                {status.type === 'success' ? <CheckCircle className="w-5 h-5 shrink-0" /> : <AlertCircle className="w-5 h-5 shrink-0" />}
                <pre className="whitespace-pre-wrap font-sans">{status.msg}</pre>
              </div>
            )}

            <div className="flex-1 relative">
              {loading ? (
                 <div className="absolute inset-0 flex items-center justify-center bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                 </div>
              ) : (
                <textarea
                  className="w-full h-full p-4 font-mono text-sm bg-slate-900 text-slate-300 focus:outline-none resize-none"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  spellCheck={false}
                />
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
