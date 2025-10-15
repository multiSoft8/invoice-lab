'use client';
import { useEffect, useState } from 'react';

interface ProcessingResult {
  id: string;
  filename: string;
  configId: string;
  clientInfo: any;
  status: 'processing' | 'completed' | 'failed';
  result?: any;
  error?: string;
  createdAt: string;
  completedAt?: string;
  duration?: number;
}

interface SideBySideModalProps {
  filename: string;
  configId: string;
  configName: string;
  configMethod: string;
  processingResult: ProcessingResult | null;
  processingState: 'idle' | 'processing' | 'completed' | 'error';
  isOpen: boolean;
  onClose: () => void;
  onProcess?: () => void;
}

export default function SideBySideModal({
  filename,
  configId,
  configName,
  configMethod,
  processingResult,
  processingState,
  isOpen,
  onClose,
  onProcess
}: SideBySideModalProps) {
  const [copiedToClipboard, setCopiedToClipboard] = useState(false);

  // Reset copied state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setCopiedToClipboard(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Get file type for display
  function getFileType(filename: string): 'pdf' | 'image' | 'text' | 'other' {
    const lower = filename.toLowerCase();
    if (lower.endsWith('.pdf')) return 'pdf';
    if (/(\.png|\.jpe?g|\.webp|\.gif|\.bmp|\.svg|\.tiff?)$/.test(lower)) return 'image';
    if (/(\.txt|\.csv|\.json)$/.test(lower)) return 'text';
    return 'other';
  }

  // Render invoice preview content
  function renderInvoicePreview() {
    const fileType = getFileType(filename);
    const src = `http://localhost:4000/files/${encodeURIComponent(filename)}`;

    switch (fileType) {
      case 'pdf':
        return (
          <iframe 
            src={src} 
            className="w-full h-full border-0" 
            title={`Preview of ${filename}`}
          />
        );
      case 'image':
        return (
          <div className="w-full h-full flex items-center justify-center bg-gray-50">
            <img 
              src={src} 
              alt={filename} 
              className="max-w-full max-h-full object-contain"
            />
          </div>
        );
      case 'text':
        return (
          <iframe 
            src={src} 
            className="w-full h-full border-0 bg-white" 
            title={`Preview of ${filename}`}
          />
        );
      default:
        return (
          <div className="w-full h-full flex items-center justify-center bg-gray-50">
            <div className="text-center space-y-3">
              <svg className="mx-auto h-16 w-16 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <div className="text-sm text-gray-600">
                Preview not supported for this file type.
              </div>
              <a 
                className="inline-block text-sm text-blue-600 hover:underline" 
                href={src} 
                target="_blank"
                rel="noopener noreferrer"
              >
                Download file
              </a>
            </div>
          </div>
        );
    }
  }

  // Render processing output
  function renderProcessingOutput() {
    // State: No result available (idle)
    if (processingState === 'idle') {
      return (
        <div className="w-full h-full flex items-center justify-center bg-gray-50">
          <div className="text-center space-y-4 max-w-md p-6">
            <svg className="mx-auto h-16 w-16 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01" />
            </svg>
            <div>
              <div className="text-lg font-semibold text-gray-700 mb-2">
                No processing output available yet
              </div>
              <div className="text-sm text-gray-600 mb-4">
                Process this invoice with <span className="font-medium">{configName}</span> to see results here.
              </div>
              {onProcess && (
                <button
                  onClick={onProcess}
                  className="inline-flex items-center justify-center gap-2 rounded-md bg-green-600 hover:bg-green-500 text-white px-4 py-2 text-sm shadow focus:outline-none focus:ring-2 focus:ring-green-400"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                    <path fillRule="evenodd" d="M4.5 5.653c0-1.427 1.529-2.33 2.779-1.643l11.54 6.347c1.295.712 1.295 2.573 0 3.286L7.28 19.99c-1.25.687-2.779-.217-2.779-1.643V5.653Z" clipRule="evenodd" />
                  </svg>
                  Process Now
                </button>
              )}
            </div>
          </div>
        </div>
      );
    }

    // State: Processing
    if (processingState === 'processing') {
      return (
        <div className="w-full h-full flex items-center justify-center bg-gray-50">
          <div className="text-center space-y-4">
            <svg className="animate-spin h-12 w-12 mx-auto text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <div className="text-lg font-semibold text-gray-700">
              Processing invoice...
            </div>
            <div className="text-sm text-gray-600">
              This may take a few moments
            </div>
          </div>
        </div>
      );
    }

    // State: Error
    if (processingState === 'error' || (processingResult && processingResult.status === 'failed')) {
      return (
        <div className="w-full h-full flex items-center justify-center bg-gray-50">
          <div className="text-center space-y-4 max-w-md p-6">
            <svg className="mx-auto h-16 w-16 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <div className="text-lg font-semibold text-red-700 mb-2">
                Processing Failed
              </div>
              <div className="text-sm text-gray-700 mb-4 bg-red-50 p-3 rounded border border-red-200">
                {processingResult?.error || 'An unknown error occurred during processing'}
              </div>
              {onProcess && (
                <button
                  onClick={onProcess}
                  className="inline-flex items-center justify-center gap-2 rounded-md bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 text-sm shadow focus:outline-none focus:ring-2 focus:ring-blue-400"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                    <path fillRule="evenodd" d="M4.755 10.059a7.5 7.5 0 0 1 12.548-3.364l1.901 1.901a.75.75 0 0 1-1.06 1.06l-1.901-1.901a6 6 0 0 0-8.978 8.978l1.901 1.901a.75.75 0 0 1-1.06 1.06l-1.901-1.901a7.5 7.5 0 0 1 0-10.635Z" clipRule="evenodd" />
                  </svg>
                  Retry
                </button>
              )}
            </div>
          </div>
        </div>
      );
    }

    // State: Completed - show JSON output
    if (processingState === 'completed' && processingResult && processingResult.result) {
      const jsonOutput = JSON.stringify(processingResult.result, null, 2);

      return (
        <div className="w-full h-full flex flex-col bg-white">
          {/* Header with metadata and actions */}
          <div className="flex-shrink-0 border-b bg-gray-50 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 text-sm text-green-600">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                    <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm13.36-1.814a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094l3.75-5.25Z" clipRule="evenodd" />
                  </svg>
                  <span className="font-semibold">Processing Completed</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(jsonOutput);
                    setCopiedToClipboard(true);
                    setTimeout(() => setCopiedToClipboard(false), 2000);
                  }}
                  className="inline-flex items-center gap-2 rounded-md bg-gray-600 hover:bg-gray-500 text-white px-3 py-1.5 text-sm shadow focus:outline-none focus:ring-2 focus:ring-gray-400"
                >
                  {copiedToClipboard ? (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                        <path fillRule="evenodd" d="M19.916 4.626a.75.75 0 01.208 1.04l-9 13.5a.75.75 0 01-1.154.114l-6-6a.75.75 0 011.06-1.06l5.353 5.353 8.493-12.739a.75.75 0 011.04-.208z" clipRule="evenodd" />
                      </svg>
                      Copied!
                    </>
                  ) : (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                        <path d="M7.5 3.375c0-1.036.84-1.875 1.875-1.875h.375a3.75 3.75 0 0 1 3.75 3.75v1.875C13.5 8.161 14.34 9 15.375 9h1.875A3.75 3.75 0 0 1 21 12.75v3.375C21 17.16 20.16 18 19.125 18h-9.75A1.875 1.875 0 0 1 7.5 16.125V3.375Z" />
                        <path d="M15 5.25a5.23 5.23 0 0 0-1.279-3.434 9.768 9.768 0 0 1 6.963 6.963A5.23 5.23 0 0 0 17.25 7.5h-1.875A.375.375 0 0 1 15 7.125V5.25ZM4.875 6H6v10.125A3.375 3.375 0 0 0 9.375 19.5H16.5v1.125c0 1.035-.84 1.875-1.875 1.875h-9.75A1.875 1.875 0 0 1 3 20.625V7.875C3 6.839 3.84 6 4.875 6Z" />
                      </svg>
                      Copy JSON
                    </>
                  )}
                </button>
                <button
                  onClick={() => {
                    const blob = new Blob([jsonOutput], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${filename.replace(/\.[^/.]+$/, '')}-${configName}-${processingResult.id.slice(0, 8)}.json`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                  }}
                  className="inline-flex items-center gap-2 rounded-md bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 text-sm shadow focus:outline-none focus:ring-2 focus:ring-blue-400"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                    <path fillRule="evenodd" d="M12 2.25a.75.75 0 0 1 .75.75v11.69l3.22-3.22a.75.75 0 1 1 1.06 1.06l-4.5 4.5a.75.75 0 0 1-1.06 0l-4.5-4.5a.75.75 0 1 1 1.06-1.06l3.22 3.22V3a.75.75 0 0 1 .75-.75Zm-9 13.5a.75.75 0 0 1 .75.75v2.25a1.5 1.5 0 0 0 1.5 1.5h13.5a1.5 1.5 0 0 0 1.5-1.5V16.5a.75.75 0 0 1 1.5 0v2.25a3 3 0 0 1-3 3H5.25a3 3 0 0 1-3-3V16.5a.75.75 0 0 1 .75-.75Z" clipRule="evenodd" />
                  </svg>
                  Download
                </button>
              </div>
            </div>
            <div className="flex items-center gap-4 text-xs text-gray-600">
              <div className="flex items-center gap-1">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                  <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25ZM12.75 6a.75.75 0 0 0-1.5 0v6c0 .414.336.75.75.75h4.5a.75.75 0 0 0 0-1.5h-3.75V6Z" clipRule="evenodd" />
                </svg>
                <span>Duration: <span className="font-medium">{processingResult.duration}ms</span></span>
              </div>
              <div className="flex items-center gap-1">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                  <path d="M12.75 12.75a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM7.5 15.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5ZM8.25 17.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM9.75 15.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5ZM10.5 17.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM12 15.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5ZM12.75 17.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM14.25 15.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5ZM15 17.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM16.5 15.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5ZM15 12.75a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM16.5 13.5a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z" />
                  <path fillRule="evenodd" d="M6.75 2.25A.75.75 0 0 1 7.5 3v1.5h9V3A.75.75 0 0 1 18 3v1.5h.75a3 3 0 0 1 3 3v11.25a3 3 0 0 1-3 3H5.25a3 3 0 0 1-3-3V7.5a3 3 0 0 1 3-3H6V3a.75.75 0 0 1 .75-.75Zm13.5 9a1.5 1.5 0 0 0-1.5-1.5H5.25a1.5 1.5 0 0 0-1.5 1.5v7.5a1.5 1.5 0 0 0 1.5 1.5h13.5a1.5 1.5 0 0 0 1.5-1.5v-7.5Z" clipRule="evenodd" />
                </svg>
                <span>Completed: <span className="font-medium">{processingResult.completedAt ? new Date(processingResult.completedAt).toLocaleString() : 'N/A'}</span></span>
              </div>
              <div className="flex items-center gap-1">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                  <path d="M10.464 8.746c.227-.18.497-.311.786-.394v2.795a2.252 2.252 0 0 1-.786-.393c-.394-.313-.546-.681-.546-1.004 0-.323.152-.691.546-1.004ZM12.75 15.662v-2.824c.347.085.664.228.921.421.427.32.579.686.579.991 0 .305-.152.671-.579.991a2.534 2.534 0 0 1-.921.42Z" />
                  <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25ZM12.75 6a.75.75 0 0 0-1.5 0v.816a3.836 3.836 0 0 0-1.72.756c-.712.566-1.112 1.35-1.112 2.178 0 .829.4 1.612 1.113 2.178.502.4 1.102.647 1.719.756v2.978a2.536 2.536 0 0 1-.921-.421l-.879-.66a.75.75 0 0 0-.9 1.2l.879.66c.533.4 1.169.645 1.821.75V18a.75.75 0 0 0 1.5 0v-.81a4.124 4.124 0 0 0 1.821-.749c.745-.559 1.179-1.344 1.179-2.191 0-.847-.434-1.632-1.179-2.191a4.122 4.122 0 0 0-1.821-.75V8.354c.29.082.559.213.786.393l.415.33a.75.75 0 0 0 .933-1.175l-.415-.33a3.836 3.836 0 0 0-1.719-.755V6Z" clipRule="evenodd" />
                </svg>
                <span>Processing ID: <span className="font-mono text-xs">{processingResult.id.slice(0, 8)}...</span></span>
              </div>
            </div>
          </div>

          {/* JSON Output */}
          <div className="flex-1 overflow-auto p-4 bg-gray-900">
            <pre className="text-sm text-gray-100 font-mono leading-relaxed">
              <code className="language-json">{jsonOutput}</code>
            </pre>
          </div>
        </div>
      );
    }

    // Fallback
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-50">
        <div className="text-center text-gray-500">
          <div className="text-sm">No output available</div>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-2xl overflow-hidden"
        style={{ width: '95vw', height: '90vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b bg-gray-50 px-6 py-4">
          <div className="flex items-center gap-3">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6 text-blue-600">
              <path d="M11.644 1.59a.75.75 0 0 1 .712 0l9.75 5.25a.75.75 0 0 1 0 1.32l-9.75 5.25a.75.75 0 0 1-.712 0l-9.75-5.25a.75.75 0 0 1 0-1.32l9.75-5.25Z" />
              <path d="m3.265 10.602 7.668 4.129a2.25 2.25 0 0 0 2.134 0l7.668-4.13 1.37.739a.75.75 0 0 1 0 1.32l-9.75 5.25a.75.75 0 0 1-.71 0l-9.75-5.25a.75.75 0 0 1 0-1.32l1.37-.738Z" />
              <path d="m10.933 19.231-7.668-4.13-1.37.739a.75.75 0 0 0 0 1.32l9.75 5.25c.221.12.489.12.71 0l9.75-5.25a.75.75 0 0 0 0-1.32l-1.37-.738-7.668 4.13a2.25 2.25 0 0 1-2.134-.001Z" />
            </svg>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Side-by-Side Comparison
              </h2>
              <div className="text-sm text-gray-600">
                <span className="font-medium">{filename}</span>
                {' × '}
                <span className="font-medium">{configName}</span>
                <span className={`ml-2 px-2 py-0.5 rounded text-xs ${
                  configMethod === 'LLM' ? 'bg-blue-100 text-blue-800' : 
                  configMethod === 'API' ? 'bg-green-100 text-green-800' : 
                  'bg-purple-100 text-purple-800'
                }`}>
                  {configMethod}
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="inline-flex items-center justify-center rounded-md hover:bg-gray-200 p-2 text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-400"
            aria-label="Close modal"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6">
              <path fillRule="evenodd" d="M5.47 5.47a.75.75 0 0 1 1.06 0L12 10.94l5.47-5.47a.75.75 0 1 1 1.06 1.06L13.06 12l5.47 5.47a.75.75 0 1 1-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 0 1-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        {/* Split Panel Content */}
        <div className="flex h-[calc(90vh-80px)]">
          {/* Left Panel - Invoice Preview */}
          <div className="w-1/2 border-r flex flex-col">
            <div className="flex-shrink-0 bg-gray-100 px-4 py-2 border-b">
              <div className="text-sm font-semibold text-gray-700">Original Invoice</div>
            </div>
            <div className="flex-1 overflow-auto">
              {renderInvoicePreview()}
            </div>
          </div>

          {/* Right Panel - Processing Output */}
          <div className="w-1/2 flex flex-col">
            <div className="flex-shrink-0 bg-gray-100 px-4 py-2 border-b">
              <div className="text-sm font-semibold text-gray-700">Processing Output</div>
            </div>
            <div className="flex-1 overflow-auto">
              {renderProcessingOutput()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


