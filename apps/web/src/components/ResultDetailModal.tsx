'use client';
import { useState, useEffect } from 'react';
import { ProcessingResult, getProcessingResult } from '../lib/api';

interface ResultDetailModalProps {
  resultId: string | null;
  onClose: () => void;
}

export default function ResultDetailModal({ resultId, onClose }: ResultDetailModalProps) {
  const [result, setResult] = useState<ProcessingResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!resultId) return;

    async function loadResult() {
      setLoading(true);
      setError(null);
      try {
        const response = await getProcessingResult(resultId);
        setResult(response.result);
      } catch (e: any) {
        setError(String(e));
      } finally {
        setLoading(false);
      }
    }

    loadResult();
  }, [resultId]);

  if (!resultId) return null;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div
        className="bg-white rounded-lg shadow-lg max-w-4xl w-full max-h-[90vh] overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b p-4">
          <div>
            <h2 className="text-lg font-semibold">Processing Result Details</h2>
            {result && (
              <p className="text-sm text-gray-600">
                {result.filename} • {result.status} • {result.duration}ms
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-400 rounded p-1"
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto max-h-[calc(90vh-80px)]">
          {loading && (
            <div className="flex items-center justify-center py-8">
              <div className="inline-flex items-center gap-2 text-gray-600">
                <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Loading result details...
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center gap-2 text-red-800">
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                Error loading result: {error}
              </div>
            </div>
          )}

          {result && (
            <div className="space-y-6">
              {/* Status and Metadata */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-semibold mb-3">Processing Information</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium text-gray-600">Status:</span>
                    <span className={`ml-2 px-2 py-1 rounded text-xs ${
                      result.status === 'completed' ? 'bg-green-100 text-green-800' :
                      result.status === 'failed' ? 'bg-red-100 text-red-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {result.status}
                    </span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-600">Duration:</span>
                    <span className="ml-2">{result.duration}ms</span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-600">Created:</span>
                    <span className="ml-2">{new Date(result.createdAt).toLocaleString()}</span>
                  </div>
                  {result.completedAt && (
                    <div>
                      <span className="font-medium text-gray-600">Completed:</span>
                      <span className="ml-2">{new Date(result.completedAt).toLocaleString()}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Client Information */}
              {result.clientInfo && (
                <div className="bg-blue-50 rounded-lg p-4">
                  <h3 className="font-semibold mb-3">Client Information</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium text-gray-600">Business ID:</span>
                      <span className="ml-2">{result.clientInfo.businessId}</span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-600">Name:</span>
                      <span className="ml-2">{result.clientInfo.name}</span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-600">Country:</span>
                      <span className="ml-2">{result.clientInfo.country}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Error Information */}
              {result.error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <h3 className="font-semibold text-red-800 mb-2">Error Details</h3>
                  <div className="text-sm text-red-700 bg-red-100 p-3 rounded font-mono">
                    {result.error}
                  </div>
                </div>
              )}

              {/* Processing Result */}
              {result.result && (
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg">Extracted Invoice Data</h3>
                  
                  {/* Invoice Summary */}
                  {result.result.totalInOriginalCurrency && (
                    <div className="bg-green-50 rounded-lg p-4">
                      <h4 className="font-semibold mb-3">Invoice Summary</h4>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="font-medium text-gray-600">Total Amount:</span>
                          <span className="ml-2 font-semibold">
                            {result.result.totalInOriginalCurrency} {result.result.currencyISO || ''}
                          </span>
                        </div>
                        {result.result.totalWithoutVatInOriginalCurrency && (
                          <div>
                            <span className="font-medium text-gray-600">Amount (excl. VAT):</span>
                            <span className="ml-2">
                              {result.result.totalWithoutVatInOriginalCurrency} {result.result.currencyISO || ''}
                            </span>
                          </div>
                        )}
                        {result.result.documentType && (
                          <div>
                            <span className="font-medium text-gray-600">Document Type:</span>
                            <span className="ml-2">{result.result.documentType}</span>
                          </div>
                        )}
                        {result.result.invoiceDetails?.invoiceNumber && (
                          <div>
                            <span className="font-medium text-gray-600">Invoice Number:</span>
                            <span className="ml-2">{result.result.invoiceDetails.invoiceNumber}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Seller Information */}
                  {result.result.seller && (
                    <div className="bg-gray-50 rounded-lg p-4">
                      <h4 className="font-semibold mb-3">Seller Information</h4>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="font-medium text-gray-600">Name:</span>
                          <span className="ml-2">{result.result.seller.name}</span>
                        </div>
                        {result.result.seller.businessId && (
                          <div>
                            <span className="font-medium text-gray-600">Business ID:</span>
                            <span className="ml-2">{result.result.seller.businessId}</span>
                          </div>
                        )}
                        {result.result.seller.vatNumber && (
                          <div>
                            <span className="font-medium text-gray-600">VAT Number:</span>
                            <span className="ml-2">{result.result.seller.vatNumber}</span>
                          </div>
                        )}
                        {result.result.seller.email && (
                          <div>
                            <span className="font-medium text-gray-600">Email:</span>
                            <span className="ml-2">{result.result.seller.email}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Customer Information */}
                  {result.result.customer && (
                    <div className="bg-blue-50 rounded-lg p-4">
                      <h4 className="font-semibold mb-3">Customer Information</h4>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="font-medium text-gray-600">Name:</span>
                          <span className="ml-2">{result.result.customer.name}</span>
                        </div>
                        {result.result.customer.businessId && (
                          <div>
                            <span className="font-medium text-gray-600">Business ID:</span>
                            <span className="ml-2">{result.result.customer.businessId}</span>
                          </div>
                        )}
                        {result.result.customer.vatNumber && (
                          <div>
                            <span className="font-medium text-gray-600">VAT Number:</span>
                            <span className="ml-2">{result.result.customer.vatNumber}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Line Items */}
                  {result.result.lineItems && result.result.lineItems.length > 0 && (
                    <div className="bg-yellow-50 rounded-lg p-4">
                      <h4 className="font-semibold mb-3">Line Items</h4>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-100">
                            <tr>
                              <th className="text-left p-2">Description</th>
                              <th className="text-right p-2">Quantity</th>
                              <th className="text-right p-2">Unit Price</th>
                              <th className="text-right p-2">Total</th>
                              <th className="text-right p-2">VAT Rate</th>
                            </tr>
                          </thead>
                          <tbody>
                            {result.result.lineItems.map((item: any, index: number) => (
                              <tr key={index} className="border-t">
                                <td className="p-2">{item.description}</td>
                                <td className="p-2 text-right">{item.quantity || '-'}</td>
                                <td className="p-2 text-right">{item.unitPrice || '-'}</td>
                                <td className="p-2 text-right">{item.lineTotal || '-'}</td>
                                <td className="p-2 text-right">{item.lineVatRate ? `${item.lineVatRate}%` : '-'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* VAT Breakdown */}
                  {result.result.vatBreakdown && result.result.vatBreakdown.length > 0 && (
                    <div className="bg-purple-50 rounded-lg p-4">
                      <h4 className="font-semibold mb-3">VAT Breakdown</h4>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-100">
                            <tr>
                              <th className="text-left p-2">VAT Rate</th>
                              <th className="text-right p-2">Net Amount</th>
                              <th className="text-right p-2">VAT Amount</th>
                              <th className="text-right p-2">Gross Amount</th>
                            </tr>
                          </thead>
                          <tbody>
                            {result.result.vatBreakdown.map((vat: any, index: number) => (
                              <tr key={index} className="border-t">
                                <td className="p-2">{vat.vatRate ? `${vat.vatRate}%` : '-'}</td>
                                <td className="p-2 text-right">{vat.totalWithoutVat || '-'}</td>
                                <td className="p-2 text-right">{vat.totalVatAmount || '-'}</td>
                                <td className="p-2 text-right">{vat.total || '-'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Raw Data */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="font-semibold mb-3">Raw Data</h4>
                    <div className="bg-gray-900 text-green-400 p-4 rounded text-xs font-mono overflow-x-auto">
                      <pre>{JSON.stringify(result.result, null, 2)}</pre>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

