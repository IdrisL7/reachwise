
"use client";

import React, { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Layers,
  UploadCloud,
  Play,
  FileText,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Download,
  XCircle,
  ChevronDown,
  RefreshCcw,
} from 'lucide-react';

// Mock data types for demonstration
interface BatchItem {
  id: string;
  domain: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  hook?: string;
  confidence?: number;
  error?: string;
}

const BatchMode = () => {
  const [processingState, setProcessingState] = useState<'idle' | 'uploading' | 'processing' | 'completed' | 'error'>('idle');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [batchItems, setBatchItems] = useState<BatchItem[]>([]);
  const [processedCount, setProcessedCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState('VP Sales / Head of Sales');
  const [batchLimit, setBatchLimit] = useState<number | null>(null);

  useEffect(() => {
    fetch('/api/user-stats')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.limits?.batchSize != null) {
          setBatchLimit(data.limits.batchSize);
        }
      })
      .catch(() => {});
  }, []);

  // --- Mock File Upload Logic ---
  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setUploadedFile(file);
      setProcessingState('uploading');
      setError(null);

      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
        if (lines.length < 2) {
          setError("CSV must have a header row and at least one domain.");
          setProcessingState('error');
          return;
        }
        const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, '').toLowerCase());
        const colIndex = headers.findIndex(h => h === 'domain' || h === 'url');
        const domains = lines.slice(1).map(line => {
          const cols = line.split(',').map(c => c.trim().replace(/^"|"$/g, ''));
          return colIndex >= 0 ? cols[colIndex] : cols[0];
        }).filter(Boolean);
        if (domains.length > 0) {
          const items: BatchItem[] = domains.map((domain, index) => ({
            id: `item-${index}`,
            domain,
            status: 'pending',
          }));
          setBatchItems(items);
          setProcessingState('idle');
        } else {
          setError("CSV/Excel must contain at least one domain.");
          setProcessingState('error');
        }
      };
      reader.onerror = () => {
        setError("Failed to read file.");
        setProcessingState('error');
      };
      reader.readAsText(file); // Only for text files like CSV. For Excel, use a library like 'xlsx'.
    }
  }, []);

  // --- Real Batch Processing ---
  const runBatchAnalysis = useCallback(async () => {
    if (!uploadedFile || batchItems.length === 0) {
      setError("Please upload a file with domains first.");
      setProcessingState('error');
      return;
    }

    setProcessingState('processing');
    setProcessedCount(0);
    setError(null);

    try {
      const items = batchItems.map(item => ({
        url: item.domain.startsWith('http') ? item.domain : `https://${item.domain}`,
        pitchContext: '',
      }));

      const res = await fetch('/api/generate-hooks-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items, maxHooksPerUrl: 1 }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message ?? data.error ?? 'Batch processing failed');
        setProcessingState('error');
        return;
      }

      const results: typeof batchItems = (data.results ?? []).map(
        (result: { url: string; hooks: Array<{ hook: string; quality_score?: number }>; error?: string | null; intent?: { score: number } | null }, index: number) => ({
          id: `item-${index}`,
          domain: batchItems[index]?.domain ?? result.url,
          status: result.error ? 'failed' : 'completed',
          hook: result.hooks?.[0]?.hook ?? undefined,
          confidence: result.intent?.score ?? result.hooks?.[0]?.quality_score ?? undefined,
          error: result.error ?? undefined,
        })
      );

      setBatchItems(results);
      setProcessedCount(results.length);
      setProcessingState('completed');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unexpected error during batch processing');
      setProcessingState('error');
    }
  }, [uploadedFile, batchItems]);

  const totalItems = batchItems.length;
  const progressPercentage = totalItems > 0 ? (processedCount / totalItems) * 100 : 0;

  // --- Reset Function ---
  const resetWorkflow = useCallback(() => {
    setProcessingState('idle');
    setUploadedFile(null);
    setBatchItems([]);
    setProcessedCount(0);
    setError(null);
  }, []);

  // --- Download Results ---
  const downloadResults = useCallback(() => {
    const csvContent = "data:text/csv;charset=utf-8,"
      + "Domain,Status,Confidence,Hook,Error\n"
      + batchItems.map(item =>
          `"${item.domain}",` +
          `"${item.status}",` +
          `"${item.confidence ? item.confidence.toFixed(0) + '%' : 'N/A'}",` +
          `"${item.hook ? item.hook.replace(/"/g, '""') : 'N/A'}",` +
          `"${item.error ? item.error.replace(/"/g, '""') : 'N/A'}"`
        ).join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'batch_signal_hooks_results.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [batchItems]);

  return (
    <div className="bg-[#030014] min-h-screen p-8 text-white font-sans">
      {/* 1. Header & Strategy Selection */}
      <div className="flex justify-between items-end mb-10">
        <div>
          <div className="flex items-center gap-2 text-purple-400 font-bold text-xs uppercase tracking-widest mb-2">
            <Layers size={14} /> Power Workflow
          </div>
          <h1 className="text-3xl font-bold">Batch Signal Research</h1>
          <p className="text-slate-400 mt-1">Upload a CSV of domains to generate evidence-backed hooks at scale.</p>
        </div>

        <div className="flex gap-3">
          <div className="bg-white/5 border border-white/10 rounded-lg p-1 flex">
            <button className={`px-4 py-2 rounded-md text-sm font-bold ${true ? 'bg-purple-600' : 'text-slate-400 hover:text-white transition-colors'}`}>Standard</button>
            <button className="px-4 py-2 text-slate-400 text-sm font-bold hover:text-white transition-colors">Deep Scan (Pro)</button>
          </div>
        </div>
      </div>

      {error && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-red-900/40 border border-red-700 text-red-300 px-6 py-4 rounded-xl mb-6 flex items-center gap-3"
        >
          <AlertCircle size={20} />
          <p className="font-medium text-sm">{error}</p>
          <button onClick={() => setError(null)} className="ml-auto text-red-300 hover:text-white">
            <XCircle size={18} />
          </button>
        </motion.div>
      )}

      <div className="grid lg:grid-cols-3 gap-8">
        {/* 2. Upload & Configuration (Left) */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-[#111111] border border-white/5 rounded-2xl p-6">
            <h3 className="font-bold mb-4 flex items-center gap-2">
              <UploadCloud size={18} className="text-purple-400" /> 1. Upload Leads
            </h3>
            <label htmlFor="file-upload" className="border-2 border-dashed border-white/10 rounded-xl p-8 text-center hover:border-purple-500/40 transition-colors cursor-pointer group block">
              <input id="file-upload" type="file" accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="hidden" onChange={handleFileUpload} disabled={processingState === 'processing' || processingState === 'uploading'} />
              {uploadedFile ? (
                <div className="flex flex-col items-center">
                  <FileText className="mx-auto mb-3 text-purple-400" size={32} />
                  <p className="text-sm font-medium text-slate-300">{uploadedFile.name}</p>
                  <p className="text-xs text-slate-500 mt-1">{totalItems} domains loaded</p>
                </div>
              ) : (
                <>
                  <FileText className="mx-auto mb-3 text-slate-600 group-hover:text-purple-400 transition-colors" size={32} />
                  <p className="text-sm font-medium text-slate-300">Drop CSV or Excel</p>
                  <p className="text-xs text-slate-500 mt-1 italic">Must include 'domain' column</p>
                </>
              )}
            </label>
            {uploadedFile && (
              <p className="text-xs text-slate-500 mt-2 text-center">
                <button onClick={resetWorkflow} className="text-purple-400 hover:text-purple-300 underline">Clear file</button>
              </p>
            )}
            {batchLimit != null && (
              <p className="text-xs text-slate-500 mt-3">
                Your plan supports up to{' '}
                <span className="text-slate-400 font-medium">
                  {batchLimit === -1 ? 'unlimited' : batchLimit} domain{batchLimit !== 1 && batchLimit !== -1 ? 's' : ''}
                </span>{' '}
                per batch.
              </p>
            )}
          </div>

          <div className="bg-[#111111] border border-white/5 rounded-2xl p-6">
            <h3 className="font-bold mb-4 flex items-center gap-2">
              <Play size={18} className="text-purple-400" /> 2. Research Parameters
            </h3>
            <div className="space-y-4">
              <div>
                <label className="text-[10px] uppercase font-black text-slate-500 block mb-2">Target Buyer Role</label>
                <div className="relative">
                  <select
                    className="w-full bg-[#0B0F1A] border border-white/10 rounded-lg p-3 text-sm outline-none focus:border-purple-500 appearance-none pr-10"
                    value={selectedRole}
                    onChange={(e) => setSelectedRole(e.target.value)}
                    disabled={processingState === 'processing' || processingState === 'uploading'}
                  >
                    <option>VP Sales / Head of Sales</option>
                    <option>RevOps / SalesOps</option>
                    <option>CEO / Founder</option>
                    <option>Marketing Director</option>
                  </select>
                  <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
              </div>
              <button
                onClick={runBatchAnalysis}
                className="w-full bg-purple-600 hover:bg-purple-700 py-4 rounded-xl font-bold transition-all shadow-lg shadow-purple-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={!uploadedFile || batchItems.length === 0 || processingState === 'processing' || processingState === 'uploading'}
              >
                {processingState === 'processing' ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 size={18} className="animate-spin" /> Processing...
                  </span>
                ) : (
                  'Run Batch Analysis'
                )}
              </button>
            </div>
          </div>
        </div>

        {/* 3. Progress & Results (Right) */}
        <div className="lg:col-span-2 space-y-8">
          <AnimatePresence mode="wait">
            {processingState === 'idle' && (
              <motion.div
                key="idle-state"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.2 }}
                className="bg-[#111111] border border-white/5 rounded-2xl p-6 h-[200px] flex items-center justify-center"
              >
                <div className="text-center text-slate-500">
                  <Play size={32} className="mx-auto mb-3" />
                  <p className="text-lg font-semibold">Ready to start batch processing.</p>
                  <p className="text-sm">Upload a file and configure parameters to begin.</p>
                </div>
              </motion.div>
            )}

            {(processingState === 'uploading' || processingState === 'processing') && (
              <motion.div
                key="processing-state"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.2 }}
                className="bg-[#111111] border border-white/5 rounded-2xl p-6"
              >
                <h3 className="font-bold mb-4 flex items-center gap-2">
                  <Loader2 size={18} className="text-purple-400 animate-spin" /> Live Progress
                </h3>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="font-medium text-slate-300">Processed: {processedCount} / {totalItems}</span>
                      <span className="text-purple-400 font-bold">{progressPercentage.toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-white/10 rounded-full h-2">
                      <motion.div
                        className="bg-purple-600 h-2 rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${progressPercentage}%` }}
                        transition={{ duration: 0.5 }}
                      ></motion.div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm text-slate-400">
                    <div>
                      <span className="font-semibold text-slate-300">Current Item:</span> {batchItems[processedCount]?.domain || 'N/A'}
                    </div>
                    <div>
                      <span className="font-semibold text-slate-300">Status:</span>
                      <span className={`ml-2 px-2 py-1 rounded-full text-xs font-medium ${
                        batchItems[processedCount]?.status === 'completed' ? 'bg-green-900/30 text-green-300' :
                        batchItems[processedCount]?.status === 'failed' ? 'bg-red-900/30 text-red-300' :
                        'bg-blue-900/30 text-blue-300'
                      }`}>
                        {batchItems[processedCount]?.status || 'Pending'}
                      </span>
                    </div>
                  </div>
                </div>
                {processingState === 'processing' && totalItems > 0 && (
                  <div className="mt-6 border-t border-white/5 pt-4">
                    <h4 className="text-sm font-semibold text-slate-400 mb-3">Last 5 Processed:</h4>
                    <div className="space-y-2">
                      {[...batchItems].slice(Math.max(0, processedCount - 5), processedCount).reverse().map(item => (
                        <motion.div
                          key={item.id}
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.2 }}
                          className="flex items-center gap-3 text-xs"
                        >
                          {item.status === 'completed' ? <CheckCircle2 size={16} className="text-green-500" /> : <AlertCircle size={16} className="text-red-500" />}
                          <span className="font-medium text-slate-300">{item.domain}</span>
                          <span className="text-slate-500 truncate flex-1">{item.hook || item.error}</span>
                          {item.confidence && <span className="text-purple-400 font-bold ml-auto">{item.confidence}%</span>}
                        </motion.div>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {processingState === 'completed' && (
              <motion.div
                key="completed-state"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.2 }}
                className="bg-[#111111] border border-white/5 rounded-2xl p-6"
              >
                <h3 className="font-bold mb-4 flex items-center gap-2 text-green-400">
                  <CheckCircle2 size={18} /> Batch Processing Complete!
                </h3>
                <div className="flex justify-between items-center mb-4">
                  <p className="text-sm text-slate-300">Successfully processed {processedCount} out of {totalItems} domains.</p>
                  <button
                    onClick={downloadResults}
                    className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white py-2 px-4 rounded-lg text-sm font-semibold transition-colors"
                  >
                    <Download size={16} /> Download Results
                  </button>
                </div>
                <button
                  onClick={resetWorkflow}
                  className="w-full flex items-center justify-center gap-2 text-purple-400 hover:text-purple-300 py-3 border border-purple-600 rounded-lg text-sm font-semibold transition-colors"
                >
                  <RefreshCcw size={16} /> Run New Batch
                </button>
              </motion.div>
            )}

            {processingState === 'error' && (
              <motion.div
                key="error-state"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.2 }}
                className="bg-[#111111] border border-white/5 rounded-2xl p-6"
              >
                <h3 className="font-bold mb-4 flex items-center gap-2 text-red-400">
                  <AlertCircle size={18} /> Error during processing
                </h3>
                <p className="text-sm text-red-300 mb-4">{error || "An unexpected error occurred."}</p>
                <button
                  onClick={resetWorkflow}
                  className="w-full flex items-center justify-center gap-2 text-red-400 hover:text-red-300 py-3 border border-red-600 rounded-lg text-sm font-semibold transition-colors"
                >
                  <RefreshCcw size={16} /> Try Again
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {(processingState === 'completed' || processingState === 'processing') && (
            <motion.div
              key="results-table"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.3 }}
              className="bg-[#111111] border border-white/5 rounded-2xl p-6"
            >
              <h3 className="font-bold mb-4 flex items-center gap-2">
                <FileText size={18} className="text-purple-400" /> Batch Results
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-400">
                  <thead>
                    <tr className="border-b border-white/5 text-slate-300">
                      <th className="py-3 px-4">Domain</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Confidence</th>
                      <th className="py-3 px-4">Hook / Error</th>
                    </tr>
                  </thead>
                  <tbody>
                    <AnimatePresence>
                      {batchItems.map((item) => (
                        <motion.tr
                          key={item.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, x: -20 }}
                          transition={{ duration: 0.15 }}
                          className="border-b border-white/5 last:border-b-0"
                        >
                          <td className="py-3 px-4 font-medium text-slate-300">{item.domain}</td>
                          <td className="py-3 px-4">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              item.status === 'completed' ? 'bg-green-900/30 text-green-300' :
                              item.status === 'failed' ? 'bg-red-900/30 text-red-300' :
                              'bg-blue-900/30 text-blue-300'
                            }`}>
                              {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-purple-400 font-bold">{item.confidence ? item.confidence.toFixed(0) + '%' : 'N/A'}</td>
                          <td className="py-3 px-4 max-w-xs truncate">{item.hook || item.error || 'N/A'}</td>
                        </motion.tr>
                      ))}
                    </AnimatePresence>
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BatchMode;
