'use client';

export default function ProcessingMethod() {
  return (
    <div className="space-y-4">
      <p className="text-sm opacity-75">Select a processing method for invoice analysis.</p>
      
      {/* Placeholder for future provider selection UI */}
      <div className="rounded-lg border-2 border-dashed border-gray-300 p-8 text-center">
        <div className="text-gray-500">
          <svg className="mx-auto h-12 w-12 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Processing Method Selection</h3>
          <p className="text-sm text-gray-500">Choose between API-based or LLM-based invoice processing</p>
        </div>
      </div>
    </div>
  );
}
