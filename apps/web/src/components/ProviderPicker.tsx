'use client';
import { useEffect, useState } from 'react';
import { listProviders, parseInvoice } from '../lib/api';

export default function ProviderPicker() {
  const [providers, setProviders] = useState<{id:string; kind:string; requires:string[]}[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listProviders().then((d) => setProviders(d.providers)).catch((e) => setError(String(e)));
  }, []);

  async function onRun() {
    if (!selected || !file) { setError('Pick provider and file'); return; }
    setLoading(true); setError(null); setResult(null);
    try {
      const r = await parseInvoice(selected, file);
      setResult(r);
    } catch (e: any) {
      setError(String(e));
    } finally { setLoading(false); }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Choose provider</h2>
        <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
          {providers.map(p => (
            <button key={p.id}
              onClick={() => setSelected(p.id)}
              className={`rounded border p-3 text-left hover:bg-gray-50 ${selected===p.id ? 'border-black' : 'border-gray-300'}`}>
              <div className="font-medium">{p.id}</div>
              <div className="text-xs opacity-75">{p.kind} · needs: {p.requires.join(', ') || 'none'}</div>
            </button>
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-xl font-semibold">Upload an invoice</h2>
        <input type="file" onChange={e => setFile(e.target.files?.[0] ?? null)} />
      </div>

      <div className="flex items-center gap-2">
        <button onClick={onRun} className="rounded bg-black text-white px-4 py-2" disabled={loading}>
          {loading ? 'Processing…' : 'Process'}
        </button>
        {selected && <span className="text-sm opacity-75">Using: {selected}</span>}
      </div>

      {error && <div className="text-red-600 text-sm">{error}</div>}

      {result && (
        <pre className="text-xs bg-gray-100 p-3 rounded overflow-auto max-h-96">{JSON.stringify(result, null, 2)}</pre>
      )}
    </div>
  );
}
