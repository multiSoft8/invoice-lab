'use client';
import { useState } from 'react';
import { uploadFile } from '../lib/api';

export default function FileUploader() {
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []);
    setFiles(picked);
  }

  async function onUpload() {
    if (files.length === 0) { setError('Pick at least one file'); return; }
    setUploading(true); setMessage(null); setError(null);
    try {
      for (const f of files) {
        await uploadFile(f);
      }
      setMessage(`${files.length} file(s) uploaded to local storage`);
      setFiles([]);
    } catch (e: any) {
      setError(String(e));
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <input type="file" multiple accept="application/pdf, image/*, .png,.jpg,.jpeg,.webp,.tiff,.tif,.gif,.bmp,.heic,.heif,.svg,.txt,.csv,.json" onChange={onPick} />
      </div>
      <div className="flex items-center gap-2">
        <button onClick={onUpload} disabled={uploading || files.length===0} className="rounded bg-black text-white px-4 py-2">
          {uploading ? 'Uploading…' : 'Upload to local storage'}
        </button>
        {files.length>0 && <span className="text-sm opacity-75">{files.length} selected</span>}
      </div>
      {message && <div className="text-green-700 text-sm">{message}</div>}
      {error && <div className="text-red-600 text-sm">{error}</div>}
    </div>
  );
}


