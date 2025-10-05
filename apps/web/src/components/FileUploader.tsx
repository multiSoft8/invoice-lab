'use client';
import { useEffect, useState } from 'react';
import { uploadFile, listFiles, deleteFileByName } from '../lib/api';

export default function FileUploader() {
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [existing, setExisting] = useState<string[]>([]);
  const [showControls, setShowControls] = useState(false);
  const [showList, setShowList] = useState(false);

  async function refreshList() {
    try {
      const { files } = await listFiles();
      setExisting(files);
    } catch (e: any) {
      // silently ignore list errors to not block upload UX
    }
  }

  useEffect(() => {
    refreshList();
  }, []);

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
      await refreshList();
    } catch (e: any) {
      setError(String(e));
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <button
          type="button"
          className="rounded border px-3 py-1 text-sm"
          onClick={() => setShowControls(v => !v)}
        >
          {showControls ? 'Hide Uploading Files' : 'Expand to Upload Files'}
        </button>
      </div>

      {showControls && (
        <>
          <div>
            <input type="file" multiple accept="application/pdf, image/*, .png,.jpg,.jpeg,.webp,.tiff,.tif,.gif,.bmp,.heic,.heif,.svg,.txt,.csv,.json" onChange={onPick} />
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onUpload} disabled={uploading || files.length===0} className="rounded bg-black text-white px-4 py-2">
              {uploading ? 'Uploading…' : 'Upload to local storage'}
            </button>
            {files.length>0 && <span className="text-sm opacity-75">{files.length} selected</span>}
          </div>
        </>
      )}
      {message && <div className="text-green-700 text-sm">{message}</div>}
      {error && <div className="text-red-600 text-sm">{error}</div>}

      <div>
        <button
          type="button"
          className="rounded border px-3 py-1 text-sm"
          onClick={() => setShowList(v => !v)}
        >
          {showList ? 'Hide Existing Files' : 'Show Existing Files'}
        </button>

        {showList && (
          <div className="mt-3">
            <h3 className="text-sm font-medium">Existing files</h3>
            <div className="mt-2 max-h-48 overflow-auto border rounded">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-white">
                  <tr>
                    <th className="text-left font-semibold p-2">Filename</th>
                    <th className="text-right font-semibold p-2 w-24">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {existing.length === 0 && (
                    <tr>
                      <td className="p-2 text-gray-500" colSpan={2}>No files yet</td>
                    </tr>
                  )}
                  {existing.map((name) => (
                    <tr key={name} className="border-t">
                      <td className="p-2">{name}</td>
                      <td className="p-2 text-right">
                        <button
                          className="text-red-600 hover:underline"
                          onClick={async () => {
                            if (!confirm(`Delete '${name}'?`)) return;
                            try {
                              await deleteFileByName(name);
                              await refreshList();
                            } catch (e: any) {
                              setError(String(e));
                            }
                          }}
                        >Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


