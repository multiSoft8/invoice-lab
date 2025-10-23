'use client';
import { useState, useEffect } from 'react';
import { getStatistics, InvoiceStatistics } from '../lib/api';
import SideBySideModal from './SideBySideModal';

export default function StatisticsTable() {
  const [statistics, setStatistics] = useState<InvoiceStatistics[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedResults, setSelectedResults] = useState<{
    [filename: string]: {
      [method: string]: boolean;
    }
  }>({});
  const [sideBySideModal, setSideBySideModal] = useState<{
    isOpen: boolean;
    filename: string;
    selectedResults: any[];
  }>({
    isOpen: false,
    filename: '',
    selectedResults: []
  });

  const refreshStatistics = async () => {
    setLoading(true);
    setError(null);
    try {
      console.log('Fetching statistics from API...');
      const response = await getStatistics();
      console.log('Statistics response:', response);
      setStatistics(response.statistics);
    } catch (e: any) {
      console.error('Error fetching statistics:', e);
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshStatistics();
  }, []);

  const handleSelectionChange = (filename: string, method: string, isSelected: boolean) => {
    setSelectedResults(prev => ({
      ...prev,
      [filename]: {
        ...prev[filename],
        [method]: isSelected
      }
    }));
  };

  const handleSideBySideView = (filename: string) => {
    const methodSelections = selectedResults[filename] || {};
    const selectedResultsList: any[] = [];

    // Collect all selected results for this invoice
    Object.entries(methodSelections).forEach(([method, isSelected]) => {
      if (isSelected) {
        const scan = statistics
          .find(stat => stat.filename === filename)
          ?.latestScans[method];
        
        if (scan && scan.status === 'completed' && scan.result) {
          selectedResultsList.push({
            configName: scan.configName,
            method: scan.method,
            result: scan.result,
            lastScanAt: scan.lastScanAt
          });
        }
      }
    });

    if (selectedResultsList.length > 0) {
      setSideBySideModal({
        isOpen: true,
        filename,
        selectedResults: selectedResultsList
      });
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <span className="text-green-600">✓</span>;
      case 'failed':
        return <span className="text-red-600">✗</span>;
      case 'timeout':
        return <span className="text-yellow-600">⏱</span>;
      default:
        return <span className="text-gray-400">-</span>;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'failed': return 'bg-red-100 text-red-800';
      case 'timeout': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Get unique methods for column headers
  const methods = Array.from(new Set(
    statistics.flatMap(stat => 
      Object.values(stat.latestScans).map(scan => scan.method)
    )
  ));

  if (loading && statistics.length === 0) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-gray-600">Loading statistics...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-600">
          {statistics.length} invoices • {methods.length} methods
        </div>
        <button
          onClick={refreshStatistics}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded p-3 text-red-800">
          {error}
        </div>
      )}

      {/* Statistics Table */}
      {statistics.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse border border-gray-300">
            <thead>
              <tr className="bg-gray-50">
                <th className="border border-gray-300 p-3 text-left">Invoice</th>
                {methods.map(method => (
                  <th key={method} className="border border-gray-300 p-3 text-center">
                    {method}
                  </th>
                ))}
                <th className="border border-gray-300 p-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {statistics.map((stat) => {
                const hasSelections = Object.values(selectedResults[stat.filename] || {}).some(selected => selected);
                
                return (
                  <tr key={stat.filename} className="hover:bg-gray-50">
                    <td className="border border-gray-300 p-3">
                      <div className="font-medium">{stat.filename}</div>
                    </td>
                    {methods.map(method => {
                      const scan = Object.values(stat.latestScans).find(s => s.method === method);
                      const isCompleted = scan?.status === 'completed';
                      const isSelected = selectedResults[stat.filename]?.[method] || false;
                      
                      return (
                        <td key={method} className="border border-gray-300 p-3 text-center">
                          {scan ? (
                            <div className="space-y-2">
                              <div className={`inline-block px-2 py-1 rounded text-xs ${getStatusColor(scan.status)}`}>
                                {getStatusIcon(scan.status)} {scan.status}
                              </div>
                              {isCompleted && (
                                <div className="flex items-center justify-center">
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={(e) => handleSelectionChange(stat.filename, method, e.target.checked)}
                                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                  />
                                  <span className="ml-2 text-xs text-gray-600">Select</span>
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                      );
                    })}
                    <td className="border border-gray-300 p-3 text-center">
                      <button
                        onClick={() => handleSideBySideView(stat.filename)}
                        disabled={!hasSelections}
                        className={`px-4 py-2 rounded text-sm ${
                          hasSelections 
                            ? 'bg-blue-600 text-white hover:bg-blue-700' 
                            : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        }`}
                      >
                        Compare Selected
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500">
          No invoices found. Upload some invoices to see statistics.
        </div>
      )}

      {/* Side-by-Side Modal */}
      {sideBySideModal.isOpen && (
        <SideBySideModal
          filename={sideBySideModal.filename}
          configName={sideBySideModal.selectedResults[0]?.configName || 'Multiple Results'}
          result={sideBySideModal.selectedResults}
          onClose={() => setSideBySideModal(prev => ({ ...prev, isOpen: false }))}
        />
      )}
    </div>
  );
}
