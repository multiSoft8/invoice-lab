'use client';
import { useEffect, useState, useRef } from 'react';
import { listFiles, getConfigs, ProcessingConfig, processInvoiceWithMCP, processInvoiceWithAPI, processInvoiceWithSmartScan, ClientInfo, ProcessingResult, getClientInfo } from '../lib/api';
import ClientInfoForm from './ClientInfoForm';
import ResultDetailModal from './ResultDetailModal';
import SideBySideModal from './SideBySideModal';

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
  const [clientInfo, setClientInfo] = useState<ClientInfo | null>(null);
  const [processingStates, setProcessingStates] = useState<Record<string, Record<string, 'idle' | 'processing' | 'completed' | 'error' | 'timeout'>>>({});
  const [processingResults, setProcessingResults] = useState<Record<string, Record<string, ProcessingResult>>>({});
  const [selectedResultId, setSelectedResultId] = useState<string | null>(null);
  
  // SideBySide modal state
  const [sideBySideModal, setSideBySideModal] = useState<{
    isOpen: boolean;
    filename: string;
    configId: string;
    configName: string;
    configMethod: string;
    processingResult: ProcessingResult | null;
    processingState: 'idle' | 'processing' | 'completed' | 'error';
  }>({
    isOpen: false,
    filename: '',
    configId: '',
    configName: '',
    configMethod: '',
    processingResult: null,
    processingState: 'idle'
  });

  // Load invoices, configurations, and client info
  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        const [filesResponse, configsResponse, savedClientInfo] = await Promise.all([
          listFiles(),
          getConfigs(),
          getClientInfo().catch(() => null) // Don't fail if client info doesn't exist
        ]);
        setInvoices(filesResponse.files);
        setConfigs(configsResponse.configs);
        
        // Set client info if it exists
        if (savedClientInfo) {
          setClientInfo(savedClientInfo);
        }
        
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
  async function handleProcessInvoice(filename: string) {
    const selected = selectedMethods[filename] || [];
    if (selected.length === 0) {
      alert('Please select at least one processing method');
      return;
    }
    
    // Check if any MCP methods are selected and client info is required
    const mcpConfigs = configs.filter(config => config.method === 'MCP' && selected.includes(config.id));
    if (mcpConfigs.length > 0 && !clientInfo) {
      alert('Client information is required for MCP processing. Please fill in the client information form.');
      return;
    }
    
    // Process each selected method
    for (const configId of selected) {
      const config = configs.find(c => c.id === configId);
      if (!config) continue;
      
      // Set processing state
      setProcessingStates(prev => ({
        ...prev,
        [filename]: {
          ...prev[filename],
          [configId]: 'processing'
        }
      }));
      
      try {
        if (config.method === 'MCP') {
          // Process with MCP
          const response = await processInvoiceWithMCP({
            filename,
            configId,
            clientInfo: clientInfo!
          });
          
          if (response.success) {
            // Create processing result
            const result: ProcessingResult = {
              id: response.processingId,
              filename,
              configId,
              clientInfo: clientInfo!,
              status: 'completed',
              result: response.result,
              createdAt: new Date().toISOString(),
              completedAt: response.timestamp,
              duration: response.duration
            };
            
            // Update states
            setProcessingStates(prev => ({
              ...prev,
              [filename]: {
                ...prev[filename],
                [configId]: 'completed'
              }
            }));
            
            setProcessingResults(prev => ({
              ...prev,
              [filename]: {
                ...prev[filename],
                [configId]: result
              }
            }));
          } else {
            throw new Error(response.error || 'MCP processing failed');
          }
        } else if (config.method === 'API') {
          // NEW: Handle API methods (like Chaintrust)
          const response = await processInvoiceWithAPI({
            filename,
            configId
          });
          
          if (response.success) {
            // Create processing result for API
            const result: ProcessingResult = {
              id: `api-${response.taskId}`,
              filename,
              configId,
              clientInfo: { businessId: '', name: '', country: '' },
              status: 'completed',
              result: response.result,
              createdAt: new Date().toISOString(),
              completedAt: new Date().toISOString(),
              duration: 0
            };
            
            // Update states
            setProcessingStates(prev => ({
              ...prev,
              [filename]: {
                ...prev[filename],
                [configId]: 'completed'
              }
            }));
            
            setProcessingResults(prev => ({
              ...prev,
              [filename]: {
                ...prev[filename],
                [configId]: result
              }
            }));
            
          } else if (response.status === 'timeout') {
            // Handle timeout gracefully - show a message instead of error
            console.log(`API processing timeout for ${filename}: ${response.message}`);
            
            // Create a timeout result
            const timeoutResult: ProcessingResult = {
              id: `api-timeout-${response.taskId}`,
              filename,
              configId,
              clientInfo: { businessId: '', name: '', country: '' },
              status: 'timeout',
              result: {
                message: response.message,
                taskId: response.taskId,
                attempts: response.attempts
              },
              createdAt: new Date().toISOString(),
              completedAt: new Date().toISOString(),
              duration: 0
            };
            
            // Update states to show timeout
            setProcessingStates(prev => ({
              ...prev,
              [filename]: {
                ...prev[filename],
                [configId]: 'timeout'
              }
            }));
            
            setProcessingResults(prev => ({
              ...prev,
              [filename]: {
                ...prev[filename],
                [configId]: timeoutResult
              }
            }));
            
          } else {
            throw new Error(response.error || 'API processing failed');
          }
        } else if (config.method === 'API' && config.name === 'SmartSCan') {
          // NEW: Handle SmartSCan processing via API endpoint
          const response = await processInvoiceWithAPI({
            filename,
            configId
          });
          
          if (response.success) {
            // Create processing result for SmartSCan
            const result: ProcessingResult = {
              id: response.resultId || `smartscan-${response.feedbackId}`,
              filename,
              configId,
              clientInfo: { businessId: '', name: '', country: '' },
              status: 'completed',
              result: response.result,
              createdAt: new Date().toISOString(),
              completedAt: new Date().toISOString(),
              duration: 0
            };
            
            // Update states
            setProcessingStates(prev => ({
              ...prev,
              [filename]: {
                ...prev[filename],
                [configId]: 'completed'
              }
            }));
            
            setProcessingResults(prev => ({
              ...prev,
              [filename]: {
                ...prev[filename],
                [configId]: result
              }
            }));
          } else {
            throw new Error(response.error || 'SmartSCan processing failed');
          }
        } else {
          // For other LLM methods, keep existing simulation
          console.log(`Processing ${filename} with ${config.method} method:`, config.name);
          
          // Simulate processing for non-MCP methods
          setTimeout(() => {
            setProcessingStates(prev => ({
              ...prev,
              [filename]: {
                ...prev[filename],
                [configId]: 'completed'
              }
            }));
          }, 2000);
        }
      } catch (error: any) {
        console.error(`Error processing ${filename} with ${config.name}:`, error);
        
        setProcessingStates(prev => ({
          ...prev,
          [filename]: {
            ...prev[filename],
            [configId]: 'error'
          }
        }));
        
        setError(`Failed to process ${filename} with ${config.name}: ${error.message}`);
      }
    }
  }

  // Check if any methods are selected for an invoice
  function hasSelectedMethods(filename: string): boolean {
    return (selectedMethods[filename] || []).length > 0;
  }

  // Get processing state for a specific invoice and method
  function getProcessingState(filename: string, configId: string): 'idle' | 'processing' | 'completed' | 'error' | 'timeout' {
    return processingStates[filename]?.[configId] || 'idle';
  }

  // Get processing result for a specific invoice and method
  function getProcessingResult(filename: string, configId: string): ProcessingResult | null {
    return processingResults[filename]?.[configId] || null;
  }

  // Check if any MCP methods are selected
  function hasMCPMethodsSelected(filename: string): boolean {
    const selected = selectedMethods[filename] || [];
    return configs.some(config => config.method === 'MCP' && selected.includes(config.id));
  }

  // Handle invoice preview click
  function handleInvoicePreview(filename: string) {
    setPreviewInvoice(filename);
  }

  // Handle viewing result details
  function handleViewResult(resultId: string) {
    setSelectedResultId(resultId);
  }

  // Handle opening SideBySide modal
  function handleSideBySideView(filename: string, config: ProcessingConfig, processingResult: ProcessingResult) {
    setSideBySideModal({
      isOpen: true,
      filename,
      configId: config.id,
      configName: config.name,
      configMethod: config.method,
      processingResult,
      processingState: 'completed'
    });
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
      const [filesResponse, configsResponse, savedClientInfo] = await Promise.all([
        listFiles(),
        getConfigs(),
        getClientInfo().catch(() => null) // Don't fail if client info doesn't exist
      ]);
      setInvoices(filesResponse.files);
      setConfigs(configsResponse.configs);
      
      // Update client info if it exists
      if (savedClientInfo) {
        setClientInfo(savedClientInfo);
      }
      
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
      {/* Client Information Form */}
      <ClientInfoForm 
        onClientInfoChange={setClientInfo}
        initialClientInfo={clientInfo || undefined}
      />

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
                      {configs.map((config) => {
                        const processingState = getProcessingState(filename, config.id);
                        const processingResult = getProcessingResult(filename, config.id);
                        
                        return (
                          <td key={config.id} className="p-3 text-center">
                            <div className="space-y-2">
                              {/* Selection checkbox */}
                              <label className="inline-flex items-center">
                                <input
                                  type="checkbox"
                                  checked={(selectedMethods[filename] || []).includes(config.id)}
                                  onChange={(e) => handleMethodSelection(filename, config.id, e.target.checked)}
                                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                />
                                <span className="ml-2 text-xs text-gray-600">Select</span>
                              </label>
                              
                              {/* Processing status */}
                              {processingState !== 'idle' && (
                                <div className="text-xs">
                                  {processingState === 'processing' && (
                                    <div className="flex items-center justify-center gap-1 text-blue-600">
                                      <svg className="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                      </svg>
                                      Processing...
                                    </div>
                                  )}
                                  {processingState === 'completed' && (
                                    <div className="flex items-center justify-center gap-1 text-green-600">
                                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-3 w-3">
                                        <path fillRule="evenodd" d="M19.916 4.626a.75.75 0 01.208 1.04l-9 13.5a.75.75 0 01-1.154.114l-6-6a.75.75 0 011.06-1.06l5.353 5.353 8.493-12.739a.75.75 0 011.04-.208z" clipRule="evenodd" />
                                      </svg>
                                      Completed
                                    </div>
                                  )}
                                  {processingState === 'error' && (
                                    <div className="flex items-center justify-center gap-1 text-red-600">
                                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-3 w-3">
                                        <path fillRule="evenodd" d="M5.47 5.47a.75.75 0 011.06 0L12 10.94l5.47-5.47a.75.75 0 111.06 1.06L13.06 12l5.47 5.47a.75.75 0 11-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 01-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 010-1.06z" clipRule="evenodd" />
                                      </svg>
                                      Error
                                    </div>
                                  )}
                                  {processingState === 'timeout' && (
                                    <div className="flex items-center justify-center gap-1 text-yellow-600">
                                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-3 w-3">
                                        <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25ZM12.75 6a.75.75 0 0 0-1.5 0v6c0 .414.336.75.75.75h4.5a.75.75 0 0 0 0-1.5h-3.75V6Z" clipRule="evenodd" />
                                      </svg>
                                      Timeout
                                    </div>
                                  )}
                                </div>
                              )}
                              
                              {/* Processing result info */}
                              {processingResult && (
                                <div className="text-xs text-gray-500">
                                  <div>ID: {processingResult.id.slice(0, 8)}...</div>
                                  {processingResult.duration && (
                                    <div>{processingResult.duration}ms</div>
                                  )}
                                </div>
                              )}
                              
                              {/* Result Actions */}
                              {processingState === 'completed' && processingResult && (
                                <div className="space-y-1">
                                  {/* Side-by-Side View Button */}
                                  <button
                                    onClick={() => handleSideBySideView(filename, config, processingResult)}
                                    className="inline-flex items-center gap-1 text-xs text-green-600 hover:text-green-800 hover:underline focus:outline-none focus:ring-2 focus:ring-green-400 rounded px-1 py-0.5"
                                    title="View invoice and results side-by-side"
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-3 w-3">
                                      <path d="M11.644 1.59a.75.75 0 0 1 .712 0l9.75 5.25a.75.75 0 0 1 0 1.32l-9.75 5.25a.75.75 0 0 1-.712 0l-9.75-5.25a.75.75 0 0 1 0-1.32l9.75-5.25Z" />
                                      <path d="m3.265 10.602 7.668 4.129a2.25 2.25 0 0 0 2.134 0l7.668-4.13 1.37.739a.75.75 0 0 1 0 1.32l-9.75 5.25a.75.75 0 0 1-.71 0l-9.75-5.25a.75.75 0 0 1 0-1.32l1.37-.738Z" />
                                      <path d="m10.933 19.231-7.668-4.13-1.37.739a.75.75 0 0 0 0 1.32l9.75 5.25c.221.12.489.12.71 0l9.75-5.25a.75.75 0 0 0 0-1.32l-1.37-.738-7.668 4.13a2.25 2.25 0 0 1-2.134-.001Z" />
                                    </svg>
                                    Side-by-Side
                                  </button>
                                  
                                  {/* JSON View Button */}
                                  <button
                                    onClick={() => handleViewResult(processingResult.id)}
                                    className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 hover:underline focus:outline-none focus:ring-2 focus:ring-blue-400 rounded px-1 py-0.5"
                                    title="View JSON results only"
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-3 w-3">
                                      <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
                                      <path fillRule="evenodd" d="M1.323 11.447C2.811 6.976 7.028 3.75 12.001 3.75c4.97 0 9.185 3.223 10.675 7.69.12.362.12.752 0 1.113-1.487 4.471-5.705 7.697-10.677 7.697-4.97 0-9.186-3.223-10.675-7.69a1.762 1.762 0 0 1 0-1.113ZM17.25 12a5.25 5.25 0 1 1-10.5 0 5.25 5.25 0 0 1 10.5 0Z" clipRule="evenodd" />
                                    </svg>
                                    JSON View
                                  </button>
                                </div>
                              )}
                              
                              {/* Timeout Actions */}
                              {processingState === 'timeout' && processingResult && (
                                <div className="space-y-1">
                                  {/* Show Timeout Message Button */}
                                  <button
                                    onClick={() => handleViewResult(processingResult.id)}
                                    className="inline-flex items-center gap-1 text-xs text-yellow-600 hover:text-yellow-800 hover:underline focus:outline-none focus:ring-2 focus:ring-yellow-400 rounded px-1 py-0.5"
                                    title="View timeout details"
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-3 w-3">
                                      <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm8.706-1.442c1.146-.573 2.437.231 2.306 1.491l-.709 2.836.042-.02a.75.75 0 0 1 .67 1.34l-.04.022c-1.147.573-2.438-.231-2.307-1.491l.708-2.836-.042.02a.75.75 0 1 1-.671-1.34l.041-.022ZM12 9a.75.75 0 1 0 0 1.5 1.5 1.5 0 0 1 0 3 .75.75 0 0 0 0 1.5 3 3 0 0 0 0-6Z" clipRule="evenodd" />
                                    </svg>
                                    View Details
                                  </button>
                                </div>
                              )}
                              
                              {/* View Error Details Link */}
                              {processingState === 'error' && processingResult && (
                                <button
                                  onClick={() => handleViewResult(processingResult.id)}
                                  className="inline-flex items-center gap-1 text-xs text-red-600 hover:text-red-800 hover:underline focus:outline-none focus:ring-2 focus:ring-red-400 rounded px-1 py-0.5"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-3 w-3">
                                    <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12ZM12 8.25a.75.75 0 0 1 .75.75v3.75a.75.75 0 0 1-1.5 0V9a.75.75 0 0 1 .75-.75Zm0 8.25a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z" clipRule="evenodd" />
                                  </svg>
                                  View Error
                                </button>
                              )}
                            </div>
                          </td>
                        );
                      })}
                      
                      {/* Process Invoice Column */}
                      <td className="p-3 text-center">
                        <div className="space-y-2">
                          <button
                            onClick={() => handleProcessInvoice(filename)}
                            disabled={!hasSelectedMethods(filename) || (hasMCPMethodsSelected(filename) && !clientInfo)}
                            className={`inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm shadow focus:outline-none focus:ring-2 ${
                              hasSelectedMethods(filename) && (!hasMCPMethodsSelected(filename) || clientInfo)
                                ? 'bg-green-600 hover:bg-green-500 text-white focus:ring-green-400'
                                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                            }`}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                              <path fillRule="evenodd" d="M4.5 5.653c0-1.427 1.529-2.33 2.779-1.643l11.54 6.347c1.295.712 1.295 2.573 0 3.286L7.28 19.99c-1.25.687-2.779-.217-2.779-1.643V5.653Z" clipRule="evenodd" />
                            </svg>
                            Process
                          </button>
                          
                          {/* Status indicators */}
                          {hasMCPMethodsSelected(filename) && !clientInfo && (
                            <div className="text-xs text-amber-600">
                              Client info required
                            </div>
                          )}
                          
                          {!hasSelectedMethods(filename) && (
                            <div className="text-xs text-gray-500">
                              Select methods first
                            </div>
                          )}
                        </div>
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

      {/* Result Detail Modal */}
      <ResultDetailModal 
        resultId={selectedResultId}
        onClose={() => setSelectedResultId(null)}
      />

      {/* Side-by-Side Modal */}
      <SideBySideModal
        filename={sideBySideModal.filename}
        configId={sideBySideModal.configId}
        configName={sideBySideModal.configName}
        configMethod={sideBySideModal.configMethod}
        processingResult={sideBySideModal.processingResult}
        processingState={sideBySideModal.processingState}
        isOpen={sideBySideModal.isOpen}
        onClose={() => setSideBySideModal(prev => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}
