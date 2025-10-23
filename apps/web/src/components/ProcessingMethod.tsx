'use client';
import { useEffect, useState } from 'react';
import { ProcessingConfig, getConfigs, createConfig, updateConfig, deleteConfig, testConnection, ConnectionTestResult } from '../lib/api';

export default function ProcessingMethod() {
  const [configs, setConfigs] = useState<ProcessingConfig[]>([]);
  const [formData, setFormData] = useState({ name: '', method: 'LLM' as 'LLM' | 'API' | 'MCP', apiKey: '', url: '', timeout: 60 });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showTable, setShowTable] = useState(false);
  const [testingConfigId, setTestingConfigId] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, ConnectionTestResult>>({});

  async function refreshConfigs() {
    try {
      const { configs } = await getConfigs();
      setConfigs(configs);
    } catch (e: any) {
      setError(String(e));
    }
  }

  useEffect(() => {
    refreshConfigs();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.name || !formData.apiKey || !formData.url) {
      setError('Please fill in all fields');
      return;
    }
    
    // Validate timeout for MCP methods
    if (formData.method === 'MCP' && (formData.timeout < 10 || formData.timeout > 300)) {
      setError('Timeout must be between 10 and 300 seconds');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      if (editingId) {
        await updateConfig(editingId, formData);
        setSuccess('Configuration updated successfully');
      } else {
        await createConfig(formData);
        setSuccess('Configuration created successfully');
      }
      setFormData({ name: '', method: 'LLM' as 'LLM' | 'API' | 'MCP', apiKey: '', url: '', timeout: 60 });
      setEditingId(null);
      await refreshConfigs();
    } catch (e: any) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  function handleEdit(config: ProcessingConfig) {
    setFormData({ 
      name: config.name, 
      method: config.method, 
      apiKey: config.apiKey, 
      url: config.url,
      timeout: config.timeout || (config.method === 'MCP' ? 60 : 30)
    });
    setEditingId(config.id);
  }

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this configuration?')) return;
    
    try {
      await deleteConfig(id);
      setSuccess('Configuration deleted successfully');
      await refreshConfigs();
    } catch (e: any) {
      setError(String(e));
    }
  }

  function maskApiKey(key: string) {
    return '•'.repeat(Math.min(key.length, 8));
  }

  async function handleTestConnection(configId: string) {
    setTestingConfigId(configId);
    try {
      const result = await testConnection(configId);
      setTestResults(prev => ({ ...prev, [configId]: result }));
    } catch (e: any) {
      const errorResult: ConnectionTestResult = {
        success: false,
        method: 'LLM', // Default, will be overridden
        error: String(e),
        duration: 0,
        timestamp: new Date().toISOString(),
        details: { errorType: 'unknown' }
      };
      setTestResults(prev => ({ ...prev, [configId]: errorResult }));
    } finally {
      setTestingConfigId(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Add New Configuration Section */}
      <div className="rounded-lg border bg-white/60 p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Add New Configuration</h3>
          <button
            type="button"
            className="inline-flex items-center justify-center gap-2 rounded-md bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 text-sm shadow focus:outline-none focus:ring-2 focus:ring-blue-400"
            onClick={() => setShowForm(v => !v)}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4 opacity-90">
              <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 0 0 2.573 1.066c1.57-.907 3.356.879 2.45 2.45-.602 1.043-.065 2.36 1.066 2.573 1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 0 0-1.066 2.573c.906 1.57-.88 3.356-2.45 2.45a1.724 1.724 0 0 0-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 0 0-2.573-1.066c-1.57.906-3.356-.88-2.45-2.45a1.724 1.724 0 0 0-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 0 0 1.066-2.573c-.906-1.57.88-3.356 2.45-2.45.9.521 2.047.134 2.573-1.066Z"/>
              <path d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"/>
            </svg>
            {showForm ? 'Hide Form' : 'Show Form'}
          </button>
        </div>

        {showForm && (
          <div className="mt-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Method</label>
                <select
                  value={formData.method}
                  onChange={(e) => setFormData({ ...formData, method: e.target.value as 'LLM' | 'API' | 'MCP' })}
                  className="w-full rounded border px-3 py-2"
                  required
                >
                  <option value="LLM">LLM</option>
                  <option value="API">API</option>
                  <option value="MCP">MCP</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full rounded border px-3 py-2"
                  placeholder="e.g., OpenAI GPT-4"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">API Key</label>
                <input
                  type="password"
                  value={formData.apiKey}
                  onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                  className="w-full rounded border px-3 py-2"
                  placeholder="Enter your API key"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">URL</label>
                <input
                  type="url"
                  value={formData.url}
                  onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                  className="w-full rounded border px-3 py-2"
                  placeholder="Enter the service URL"
                  required
                />
              </div>

              {formData.method === 'MCP' && (
                <div>
                  <label className="block text-sm font-medium mb-2">Timeout (seconds)</label>
                  <input
                    type="number"
                    value={formData.timeout}
                    onChange={(e) => setFormData({ ...formData, timeout: parseInt(e.target.value) || 60 })}
                    className="w-full rounded border px-3 py-2"
                    placeholder="60"
                    min="10"
                    max="300"
                    required
                  />
                  <p className="text-gray-500 text-xs mt-1">
                    Timeout for invoice processing (10-300 seconds, default: 60)
                  </p>
                </div>
              )}

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex items-center justify-center gap-2 rounded-md bg-green-600 hover:bg-green-500 text-white px-4 py-2 text-sm shadow focus:outline-none focus:ring-2 focus:ring-green-400 disabled:opacity-60"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                    <path d="M5.566 4.657A4.505 4.505 0 0 1 6.75 4.5h10.5c.41 0 .806.055 1.183.157A3 3 0 0 0 15.75 3h-7.5a3 3 0 0 0-2.684 1.657ZM2.25 12a3 3 0 0 1 3-3h13.5a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3H5.25a3 3 0 0 1-3-3v-6ZM5.25 7.5c-.41 0-.806.055-1.184.157A3 3 0 0 1 6.75 6h10.5a3 3 0 0 1 2.684 1.657c-.378.102-.773.157-1.184.157H5.25Z"/>
                  </svg>
                  {loading ? 'Saving...' : (editingId ? 'Update' : 'Create')}
                </button>
                
                {editingId && (
                  <button
                    type="button"
                    onClick={() => {
                      setFormData({ name: '', method: 'LLM' as 'LLM' | 'API' | 'MCP', apiKey: '', url: '', timeout: 60 });
                      setEditingId(null);
                    }}
                    className="rounded border px-4 py-2 text-sm"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </div>
        )}
      </div>

      {/* Messages */}
      {error && <div className="text-red-600 text-sm">{error}</div>}
      {success && <div className="text-green-700 text-sm">{success}</div>}

      {/* Saved Configurations Section */}
      <div className="rounded-lg border bg-white/60 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold">Saved Configurations</h3>
            <span className="text-xs text-gray-600">Total: <span className="font-medium">{configs.length}</span></span>
          </div>
          <button
            type="button"
            className="inline-flex items-center justify-center gap-2 rounded-md bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 text-sm shadow focus:outline-none focus:ring-2 focus:ring-blue-400"
            onClick={() => setShowTable(v => !v)}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4 opacity-90">
              <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 0 0 2.573 1.066c1.57-.907 3.356.879 2.45 2.45-.602 1.043-.065 2.36 1.066 2.573 1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 0 0-1.066 2.573c.906 1.57-.88 3.356-2.45 2.45a1.724 1.724 0 0 0-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 0 0-2.573-1.066c-1.57.906-3.356-.88-2.45-2.45a1.724 1.724 0 0 0-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 0 0 1.066-2.573c-.906-1.57.88-3.356 2.45-2.45.9.521 2.047.134 2.573-1.066Z"/>
              <path d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"/>
            </svg>
            {showTable ? 'Hide Table' : 'Show Table'}
          </button>
        </div>

        {showTable && (
          <div className="mt-4">
            {configs.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <svg className="mx-auto h-12 w-12 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                <p>No configurations yet. Create your first processing method above.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left font-semibold p-3">Name</th>
                      <th className="text-left font-semibold p-3">Method Type</th>
                      <th className="text-left font-semibold p-3">API Key</th>
                      <th className="text-left font-semibold p-3">URL</th>
                      <th className="text-center font-semibold p-3">Timeout</th>
                      <th className="text-center font-semibold p-3">Connectivity Test</th>
                      <th className="text-right font-semibold p-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {configs.map((config) => (
                      <tr key={config.id} className="border-t">
                        <td className="p-3">{config.name}</td>
                        <td className="p-3">
                          <span className={`px-2 py-1 rounded text-xs ${
                            config.method === 'LLM' ? 'bg-blue-100 text-blue-800' : 
                            config.method === 'API' ? 'bg-green-100 text-green-800' : 
                            'bg-purple-100 text-purple-800'
                          }`}>
                            {config.method}
                          </span>
                        </td>
                        <td className="p-3 font-mono text-gray-600">{maskApiKey(config.apiKey)}</td>
                        <td className="p-3 text-gray-600 max-w-xs truncate" title={config.url}>{config.url}</td>
                        <td className="p-3 text-center text-gray-600">
                          {config.method === 'MCP' && config.timeout ? `${config.timeout}s` : '-'}
                        </td>
                        <td className="p-3 text-center">
                          <button
                            onClick={() => handleTestConnection(config.id)}
                            disabled={testingConfigId === config.id}
                            className={`inline-flex items-center justify-center gap-1 rounded-md px-3 py-1 text-xs shadow focus:outline-none focus:ring-2 ${
                              testingConfigId === config.id
                                ? 'bg-gray-400 text-white cursor-not-allowed'
                                : testResults[config.id]?.success
                                ? 'bg-green-600 hover:bg-green-500 text-white focus:ring-green-400'
                                : testResults[config.id]?.success === false
                                ? 'bg-red-600 hover:bg-red-500 text-white focus:ring-red-400'
                                : 'bg-gray-600 hover:bg-gray-500 text-white focus:ring-gray-400'
                            }`}
                          >
                            {testingConfigId === config.id ? (
                              <>
                                <svg className="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Testing Connectivity...
                              </>
                            ) : testResults[config.id]?.success ? (
                              <>
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-3 w-3">
                                  <path fillRule="evenodd" d="M19.916 4.626a.75.75 0 01.208 1.04l-9 13.5a.75.75 0 01-1.154.114l-6-6a.75.75 0 011.06-1.06l5.353 5.353 8.493-12.739a.75.75 0 011.04-.208z" clipRule="evenodd" />
                                </svg>
                                Reachable
                              </>
                            ) : testResults[config.id]?.success === false ? (
                              <>
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-3 w-3">
                                  <path fillRule="evenodd" d="M5.47 5.47a.75.75 0 011.06 0L12 10.94l5.47-5.47a.75.75 0 111.06 1.06L13.06 12l5.47 5.47a.75.75 0 11-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 01-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 010-1.06z" clipRule="evenodd" />
                                </svg>
                                Failed
                              </>
                            ) : (
                              <>
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-3 w-3">
                                  <path fillRule="evenodd" d="M4.5 5.653c0-1.427 1.529-2.33 2.779-1.643l11.54 6.347c1.295.712 1.295 2.573 0 3.286L7.28 19.99c-1.25.687-2.779-.217-2.779-1.643V5.653Z" clipRule="evenodd" />
                                </svg>
                                Test Connectivity
                              </>
                            )}
                          </button>
                          {testResults[config.id]?.success === false && (
                            <div className="mt-1 text-xs text-red-600 max-w-xs truncate" title={testResults[config.id].error || 'Unknown error'}>
                              {testResults[config.id].error || 'Unknown error'}
                            </div>
                          )}
                        </td>
                        <td className="p-3">
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => handleEdit(config)}
                              className="text-blue-600 hover:underline text-sm"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDelete(config.id)}
                              className="text-red-600 hover:underline text-sm"
                            >
                              Delete
                            </button>
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
      </div>
    </div>
  );
}
