'use client';
import { useState, useEffect, useMemo } from 'react';
import { ClientInfo, getClientInfo, updateClientInfo } from '../lib/api';

interface ClientInfoFormProps {
  onClientInfoChange: (clientInfo: ClientInfo | null) => void;
  initialClientInfo?: ClientInfo;
}

// Simple debounce utility
function debounce<T extends (...args: any[]) => any>(func: T, delay: number): T {
  let timeoutId: NodeJS.Timeout;
  return ((...args: any[]) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  }) as T;
}

export default function ClientInfoForm({ onClientInfoChange, initialClientInfo }: ClientInfoFormProps) {
  const [clientInfo, setClientInfo] = useState<ClientInfo>({
    businessId: initialClientInfo?.businessId || '',
    name: initialClientInfo?.name || '',
    country: initialClientInfo?.country || ''
  });
  const [showForm, setShowForm] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [loadError, setLoadError] = useState<string | null>(null);

  // Common country codes for European countries
  const countryOptions = [
    { code: 'FI', name: 'Finland' },
    { code: 'SE', name: 'Sweden' },
    { code: 'NO', name: 'Norway' },
    { code: 'DK', name: 'Denmark' },
    { code: 'DE', name: 'Germany' },
    { code: 'FR', name: 'France' },
    { code: 'IT', name: 'Italy' },
    { code: 'ES', name: 'Spain' },
    { code: 'NL', name: 'Netherlands' },
    { code: 'BE', name: 'Belgium' },
    { code: 'AT', name: 'Austria' },
    { code: 'CH', name: 'Switzerland' },
    { code: 'US', name: 'United States' },
    { code: 'GB', name: 'United Kingdom' },
    { code: 'CA', name: 'Canada' }
  ];

  // Auto-load client info on mount
  useEffect(() => {
    async function loadClientInfo() {
      setLoading(true);
      setLoadError(null);
      try {
        const savedInfo = await getClientInfo();
        if (savedInfo) {
          setClientInfo(savedInfo);
          setShowForm(false); // Show summary instead of form
        }
      } catch (error: any) {
        setLoadError(error.message);
        console.error('Failed to load client info:', error);
      } finally {
        setLoading(false);
      }
    }
    
    // Only load if no initial client info provided
    if (!initialClientInfo) {
      loadClientInfo();
    }
  }, [initialClientInfo]);

  // Auto-save functionality with debouncing
  const debouncedSave = useMemo(
    () => debounce(async (clientInfo: ClientInfo) => {
      if (validateClientInfo()) {
        setSaveStatus('saving');
        try {
          await updateClientInfo(clientInfo);
          setSaveStatus('saved');
          // Clear saved status after 2 seconds
          setTimeout(() => setSaveStatus('idle'), 2000);
        } catch (error: any) {
          setSaveStatus('error');
          console.error('Failed to save client info:', error);
        }
      }
    }, 2000),
    []
  );

  useEffect(() => {
    // Validate and notify parent component
    const isValid = validateClientInfo();
    onClientInfoChange(isValid ? clientInfo : null);
    
    // Auto-save if form has data and is valid
    if (isValid && (clientInfo.businessId || clientInfo.name || clientInfo.country)) {
      debouncedSave(clientInfo);
    }
  }, [clientInfo, onClientInfoChange, debouncedSave]);

  function validateClientInfo(): boolean {
    const newErrors: Record<string, string> = {};

    // Validate business ID (VAT format)
    if (!clientInfo.businessId.trim()) {
      newErrors.businessId = 'Business ID is required';
    } else if (!/^VAT[A-Z0-9]{8,12}$/i.test(clientInfo.businessId.trim())) {
      newErrors.businessId = 'Business ID must be in VAT format (e.g., VAT123456789)';
    }

    // Validate name
    if (!clientInfo.name.trim()) {
      newErrors.name = 'Business name is required';
    } else if (clientInfo.name.trim().length < 2) {
      newErrors.name = 'Business name must be at least 2 characters';
    }

    // Validate country
    if (!clientInfo.country) {
      newErrors.country = 'Country is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function handleInputChange(field: keyof ClientInfo, value: string) {
    setClientInfo(prev => ({
      ...prev,
      [field]: value
    }));
  }

  function handleBusinessIdChange(value: string) {
    // Auto-format business ID to uppercase
    const formatted = value.toUpperCase();
    handleInputChange('businessId', formatted);
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold">Client Information</h3>
          <span className="text-xs text-gray-600">
            Required for MCP processing
          </span>
          {loading && (
            <span className="text-xs text-blue-600">Loading...</span>
          )}
          {saveStatus === 'saving' && (
            <span className="text-xs text-blue-600">Saving...</span>
          )}
          {saveStatus === 'saved' && (
            <span className="text-xs text-green-600">Saved</span>
          )}
          {saveStatus === 'error' && (
            <span className="text-xs text-red-600">Save failed</span>
          )}
        </div>
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

      {/* Error Messages */}
      {loadError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <div className="flex items-center gap-2 text-red-800">
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            Failed to load client information: {loadError}
          </div>
        </div>
      )}

      {saveStatus === 'error' && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <div className="flex items-center gap-2 text-red-800">
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            Failed to save client information. Please try again.
          </div>
        </div>
      )}

      {/* Form */}
      {showForm && (
        <div className="rounded-lg border bg-white/60 p-4">
          <form className="space-y-4">
            {/* Business ID */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Business ID (VAT Format) <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={clientInfo.businessId}
                onChange={(e) => handleBusinessIdChange(e.target.value)}
                className={`w-full rounded border px-3 py-2 ${
                  errors.businessId ? 'border-red-500 focus:ring-red-400' : 'border-gray-300 focus:ring-blue-400'
                } focus:outline-none focus:ring-2`}
                placeholder="VAT123456789"
                maxLength={15}
              />
              {errors.businessId && (
                <p className="text-red-600 text-xs mt-1">{errors.businessId}</p>
              )}
              <p className="text-gray-500 text-xs mt-1">
                Format: VAT followed by 8-12 alphanumeric characters
              </p>
            </div>

            {/* Business Name */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Business Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={clientInfo.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                className={`w-full rounded border px-3 py-2 ${
                  errors.name ? 'border-red-500 focus:ring-red-400' : 'border-gray-300 focus:ring-blue-400'
                } focus:outline-none focus:ring-2`}
                placeholder="Your Company Name"
                maxLength={100}
              />
              {errors.name && (
                <p className="text-red-600 text-xs mt-1">{errors.name}</p>
              )}
            </div>

            {/* Country */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Country <span className="text-red-500">*</span>
              </label>
              <select
                value={clientInfo.country}
                onChange={(e) => handleInputChange('country', e.target.value)}
                className={`w-full rounded border px-3 py-2 ${
                  errors.country ? 'border-red-500 focus:ring-red-400' : 'border-gray-300 focus:ring-blue-400'
                } focus:outline-none focus:ring-2`}
              >
                <option value="">Select a country</option>
                {countryOptions.map(country => (
                  <option key={country.code} value={country.code}>
                    {country.name} ({country.code})
                  </option>
                ))}
              </select>
              {errors.country && (
                <p className="text-red-600 text-xs mt-1">{errors.country}</p>
              )}
            </div>
          </form>
        </div>
      )}

      {/* Summary */}
      {!showForm && (clientInfo.businessId || clientInfo.name || clientInfo.country) && (
        <div className="rounded-lg border bg-white/60 p-4">
          <div className="text-sm">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4 text-green-600">
                  <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm13.36-1.814a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094l3.75-5.25Z" clipRule="evenodd" />
                </svg>
                <span className="font-medium text-green-700">Client Information Configured</span>
              </div>
              <button
                type="button"
                onClick={() => setShowForm(true)}
                className="text-blue-600 hover:text-blue-800 text-xs underline"
              >
                Edit
              </button>
            </div>
            <div className="space-y-1 text-gray-600">
              <div><span className="font-medium">Business ID:</span> {clientInfo.businessId || 'Not set'}</div>
              <div><span className="font-medium">Name:</span> {clientInfo.name || 'Not set'}</div>
              <div><span className="font-medium">Country:</span> {clientInfo.country || 'Not set'}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

