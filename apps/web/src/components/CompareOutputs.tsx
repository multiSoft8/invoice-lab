'use client';
import { useEffect, useState, useRef } from 'react';
import { listFiles, getConfigs, ProcessingConfig } from '../lib/api';

export default function CompareOutputs() {
  const [invoices, setInvoices] = useState<string[]>([]);
  const [configs, setConfigs] = useState<ProcessingConfig[]>([]);
  const [selectedMethods, setSelectedMethods] = useState<Record<string, string[]>>({});
  const [showTable, setShowTable] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewInvoice, setPreviewInvoice] = useState<string | null>(null);
  const [isResizing, setIsResizing] = useState(false);
  const [previewSize, setPreviewSize] = useState<{ width: number; height: number }>({ width: 960, height: 560 });
  const resizeStartMouse = useRef<{ x: number; y: number } | null>(null);
  const resizeStartSize = useRef<{ width: number; height: number } | null>(null);

  // Load invoices and configurations
  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        const [filesResponse, configsResponse] = await Promise.all([
          listFiles(),
          getConfigs()
        ]);
        setInvoices(filesResponse.files);
        setConfigs(configsResponse.configs);
        
        // Initialize selected methods for each invoice
        const initialSelections: Record<string, string[]> = {};
        filesResponse.files.forEach(filename => {
          initialSelections[filename] = [];
        });
        setSelectedMethods(initialSelections);
      } catch (e: any) {
        setError(String(e));
      } finally {
        setLoading(false);
      }
    }
    
    loadData();
  }, []);

  // Mouse event handlers for preview resize functionality
  useEffect(() => {
    function onMove(e: MouseEvent) {
      if (!isResizing || !resizeStartMouse.current || !resizeStartSize.current) return;
      const dx = e.clientX - resizeStartMouse.current.x;
      const dy = e.clientY - resizeStartMouse.current.y;
      const w = Math.max(480, Math.min(window.innerWidth - 32, resizeStartSize.current.width + dx));
      const h = Math.max(320, Math.min(window.innerHeight - 32, resizeStartSize.current.height + dy));
      setPreviewSize({ width: w, height: h });
    }
    function onUp() {
      if (isResizing) setIsResizing(false);
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [isResizing]);

  // Handle method selection for a specific invoice
  function handleMethodSelection(filename: string, configId: string, isSelected: boolean) {
    setSelectedMethods(prev => {
      const current = prev[filename] || [];
      if (isSelected) {
        return {
          ...prev,
          [filename]: [...current, configId]
        };
      } else {
        return {
          ...prev,
          [filename]: current.filter(id => id !== configId)
        };
      }
    });
  }

  // Handle process invoice button click
  function handleProcessInvoice(filename: string) {
    const selected = selectedMethods[filename] || [];
    if (selected.length === 0) {
      alert('Please select at least one processing method');
      return;
    }
    
    console.log(`Processing ${filename} with methods:`, selected);
    // TODO: Implement actual processing logic
  }

  // Check if any methods are selected for an invoice
  function hasSelectedMethods(filename: string): boolean {
    return (selectedMethods[filename] || []).length > 0;
  }

  // Handle invoice preview click
  function handleInvoicePreview(filename: string) {
    setPreviewInvoice(filename);
  }

  // Get file type for display and preview
  function getFileType(filename: string): 'pdf' | 'image' | 'text' | 'other' {
    const lower = filename.toLowerCase();
    if (lower.endsWith('.pdf')) return 'pdf';
    if (/(\.png|\.jpe?g|\.webp|\.gif|\.bmp|\.svg|\.tiff?)$/.test(lower)) return 'image';
    if (/(\.txt|\.csv|\.json)$/.test(lower)) return 'text';
    return 'other';
  }

  // Render preview content based on file type
  function renderPreviewContent(filename: string) {
    const fileType = getFileType(filename);
    const src = `http://localhost:4000/files/${encodeURIComponent(filename)}`;
    
    switch (fileType) {
      case 'pdf':
        return <iframe src={src} className="w-full h-full border" />;
      case 'image':
        return <img src={src} alt={filename} className="h-full w-full object-contain" />;
      case 'text':
        return <iframe src={src} className="w-full h-full border bg-white" />;
      default:
        return (
          <div className="text-sm">
            Preview not supported. <a className="text-blue-600 underline" href={src} target="_blank">Download</a>
          </div>
        );
    }
  }

  // Refresh data function
  async function refreshData() {
    setLoading(true);
    setError(null);
    try {
      const [filesResponse, configsResponse] = await Promise.all([
        listFiles(),
        getConfigs()
      ]);
      setInvoices(filesResponse.files);
      setConfigs(configsResponse.configs);
      
      // Initialize selected methods for each invoice
      const initialSelections: Record<string, string[]> = {};
      filesResponse.files.forEach(filename => {
        initialSelections[filename] = selectedMethods[filename] || [];
      });
      setSelectedMethods(initialSelections);
    } catch (e: any) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Summary and controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">
            Invoices: <span className="font-medium">{invoices.length}</span> | 
            Methods: <span className="font-medium">{configs.length}</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={refreshData}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-md bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 text-sm shadow focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
              <path fillRule="evenodd" d="M4.755 10.059a7.5 7.5 0 0 1 12.548-3.364l1.901 1.901a.75.75 0 0 1-1.06 1.06l-1.901-1.901a6 6 0 0 0-8.978 8.978l1.901 1.901a.75.75 0 0 1-1.06 1.06l-1.901-1.901a7.5 7.5 0 0 1 0-10.635Z" clipRule="evenodd" />
              <path fillRule="evenodd" d="M12.755 13.941a7.5 7.5 0 0 1-12.548 3.364l-1.901-1.901a.75.75 0 1 1 1.06-1.06l1.901 1.901a6 6 0 0 0 8.978-8.978l-1.901-1.901a.75.75 0 0 1 1.06-1.06l1.901 1.901a7.5 7.5 0 0 1 0 10.635Z" clipRule="evenodd" />
            </svg>
            {loading ? 'Refreshing...' : 'Refresh Table'}
          </button>
          <button
            type="button"
            className="inline-flex items-center justify-center gap-2 rounded-md bg-gray-600 hover:bg-gray-500 text-white px-4 py-2 text-sm shadow focus:outline-none focus:ring-2 focus:ring-gray-400"
            onClick={() => setShowTable(v => !v)}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4 opacity-90">
              <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 0 0 2.573 1.066c1.57-.907 3.356.879 2.45 2.45-.602 1.043-.065 2.36 1.066 2.573 1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 0 0-1.066 2.573c.906 1.57-.88 3.356-2.45 2.45a1.724 1.724 0 0 0-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 0 0-2.573-1.066c-1.57.906-3.356-.88-2.45-2.45a1.724 1.724 0 0 0-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 0 0 1.066-2.573c-.906-1.57.88-3.356 2.45-2.45.9.521 2.047.134 2.573-1.066Z"/>
              <path d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"/>
            </svg>
            {showTable ? 'Hide Table' : 'Show Table'}
          </button>
        </div>
      </div>

      {/* Error message */}
      {error && <div className="text-red-600 text-sm">{error}</div>}

      {/* Loading state */}
      {loading && (
        <div className="text-center py-4">
          <div className="inline-flex items-center gap-2 text-gray-600">
            <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Loading invoices and processing methods...
          </div>
        </div>
      )}

      {/* Table */}
      {showTable && !loading && (
        <div className="rounded-lg border bg-white/60 p-4">
          {invoices.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <svg className="mx-auto h-12 w-12 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p>No invoices found. Upload some invoices in the "Invoices" section first.</p>
            </div>
          ) : configs.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <svg className="mx-auto h-12 w-12 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 0 0 2.573 1.066c1.57-.907 3.356.879 2.45 2.45-.602 1.043-.065 2.36 1.066 2.573 1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 0 0-1.066 2.573c.906 1.57-.88 3.356-2.45 2.45a1.724 1.724 0 0 0-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 0 0-2.573-1.066c-1.57.906-3.356-.88-2.45-2.45a1.724 1.724 0 0 0-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 0 0 1.066-2.573c-.906-1.57.88-3.356 2.45-2.45.9.521 2.047.134 2.573-1.066Z"/>
                <path d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"/>
              </svg>
              <p>No processing methods configured. Create some processing methods in the "Processing Method" section first.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left font-semibold p-3 min-w-[200px]">Invoice Name</th>
                    {configs.map((config) => (
                      <th key={config.id} className="text-center font-semibold p-3 min-w-[150px]">
                        <div className="flex flex-col items-center gap-1">
                          <span>{config.name}</span>
                          <span className={`px-2 py-1 rounded text-xs ${
                            config.method === 'LLM' ? 'bg-blue-100 text-blue-800' : 
                            config.method === 'API' ? 'bg-green-100 text-green-800' : 
                            'bg-purple-100 text-purple-800'
                          }`}>
                            {config.method}
                          </span>
                        </div>
                      </th>
                    ))}
                    <th className="text-center font-semibold p-3 min-w-[120px]">Process Invoice</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((filename) => (
                    <tr key={filename} className="border-t hover:bg-gray-50">
                      {/* Invoice Name Column */}
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleInvoicePreview(filename)}
                            className="font-medium text-blue-600 hover:text-blue-800 cursor-pointer hover:underline focus:outline-none focus:ring-2 focus:ring-blue-400 rounded px-1"
                          >
                            {filename}
                          </button>
                          <span className="text-xs text-gray-500">
                            {getFileType(filename).toUpperCase()}
                          </span>
                        </div>
                      </td>
                      
                      {/* Processing Method Columns */}
                      {configs.map((config) => (
                        <td key={config.id} className="p-3 text-center">
                          <label className="inline-flex items-center">
                            <input
                              type="checkbox"
                              checked={(selectedMethods[filename] || []).includes(config.id)}
                              onChange={(e) => handleMethodSelection(filename, config.id, e.target.checked)}
                              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="ml-2 text-xs text-gray-600">Select</span>
                          </label>
                        </td>
                      ))}
                      
                      {/* Process Invoice Column */}
                      <td className="p-3 text-center">
                        <button
                          onClick={() => handleProcessInvoice(filename)}
                          disabled={!hasSelectedMethods(filename)}
                          className={`inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm shadow focus:outline-none focus:ring-2 ${
                            hasSelectedMethods(filename)
                              ? 'bg-green-600 hover:bg-green-500 text-white focus:ring-green-400'
                              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                          }`}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                            <path fillRule="evenodd" d="M4.5 5.653c0-1.427 1.529-2.33 2.779-1.643l11.54 6.347c1.295.712 1.295 2.573 0 3.286L7.28 19.99c-1.25.687-2.779-.217-2.779-1.643V5.653Z" clipRule="evenodd" />
                          </svg>
                          Process
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Preview Modal */}
      {previewInvoice && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" onClick={() => setPreviewInvoice(null)}>
          <div
            className="bg-white rounded shadow relative overflow-hidden"
            style={{ width: previewSize.width, height: previewSize.height }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b p-3 select-none cursor-default">
              <div className="font-semibold text-sm">Preview: {previewInvoice}</div>
              <button 
                className="text-sm hover:bg-gray-100 px-2 py-1 rounded focus:outline-none focus:ring-2 focus:ring-gray-400" 
                onClick={() => setPreviewInvoice(null)}
              >
                Close
              </button>
            </div>
            <div className="p-3 space-y-3 w-full h-[calc(100%-44px)] overflow-auto">
              {renderPreviewContent(previewInvoice)}
            </div>
            {/* Resize handle */}
            <div
              className="absolute right-0 bottom-0 w-4 h-4 cursor-se-resize"
              onMouseDown={(e) => {
                e.preventDefault();
                resizeStartMouse.current = { x: e.clientX, y: e.clientY };
                resizeStartSize.current = { width: previewSize.width, height: previewSize.height };
                setIsResizing(true);
              }}
            >
              <div className="w-full h-full bg-transparent" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
