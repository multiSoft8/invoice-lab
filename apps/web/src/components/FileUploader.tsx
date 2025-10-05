'use client';
import { useEffect, useRef, useState } from 'react';
import { uploadFile, listFiles, deleteFileByName } from '../lib/api';

export default function FileUploader() {
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [existing, setExisting] = useState<string[]>([]);
  const [showControls, setShowControls] = useState(false);
  const [showList, setShowList] = useState(false);
  const [previewName, setPreviewName] = useState<string | null>(null);
  const [isResizing, setIsResizing] = useState(false);
  const [previewSize, setPreviewSize] = useState<{ width: number; height: number }>({ width: 960, height: 560 });
  const resizeStartMouse = useRef<{ x: number; y: number } | null>(null);
  const resizeStartSize = useRef<{ width: number; height: number } | null>(null);

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
      <section className="rounded-lg border bg-white/60 p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">Upload</h3>
          <button
            type="button"
            className="inline-flex items-center justify-center gap-2 rounded-md bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 text-sm shadow focus:outline-none focus:ring-2 focus:ring-blue-400"
            onClick={() => setShowControls(v => !v)}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4 opacity-90">
              <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 0 0 2.573 1.066c1.57-.907 3.356.879 2.45 2.45-.602 1.043-.065 2.36 1.066 2.573 1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 0 0-1.066 2.573c.906 1.57-.88 3.356-2.45 2.45a1.724 1.724 0 0 0-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 0 0-2.573-1.066c-1.57.906-3.356-.88-2.45-2.45a1.724 1.724 0 0 0-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 0 0 1.066-2.573c-.906-1.57.88-3.356 2.45-2.45.9.521 2.047.134 2.573-1.066Z"/>
              <path d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"/>
            </svg>
            {showControls ? 'Hide Uploading Files' : 'Expand to Upload Files'}
          </button>
        </div>

        {showControls && (
          <div className="mt-3 space-y-3">
            <div className="flex items-center gap-3">
              <input
                id="file-input"
                type="file"
                multiple
                accept="application/pdf, image/*, .png,.jpg,.jpeg,.webp,.tiff,.tif,.gif,.bmp,.heic,.heif,.svg,.txt,.csv,.json"
                onChange={onPick}
                className="sr-only"
              />
              <label
                htmlFor="file-input"
                className="inline-flex items-center justify-center gap-2 rounded-md bg-amber-600 hover:bg-amber-500 text-white px-4 py-2 text-sm shadow cursor-pointer focus:outline-none focus:ring-2 focus:ring-amber-400"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4 opacity-90">
                  <path d="M16.5 6.75v8.25a4.5 4.5 0 1 1-9 0V5.25a3 3 0 0 1 6 0v8.25a1.5 1.5 0 1 1-3 0V6.75a.75.75 0 1 1 1.5 0v6.75a.75.75 0 1 0 1.5 0V5.25a4.5 4.5 0 0 0-9 0v9.75a6 6 0 1 0 12 0V6.75a.75.75 0 1 0-1.5 0Z"/>
                </svg>
                <span>Choose Files</span>
              </label>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={onUpload}
                disabled={uploading || files.length===0}
                className="inline-flex items-center justify-center gap-2 rounded-md bg-green-600 hover:bg-green-500 text-white px-4 py-2 text-sm shadow focus:outline-none focus:ring-2 focus:ring-green-400 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4 opacity-90">
                  <path d="M12 3a1 1 0 0 1 1 1v8.586l2.293-2.293a1 1 0 1 1 1.414 1.414l-4 4a1 1 0 0 1-1.414 0l-4-4a1 1 0 1 1 1.414-1.414L11 12.586V4a1 1 0 0 1 1-1Z"/>
                  <path d="M5 15a1 1 0 0 1 1 1v2h12v-2a1 1 0 1 1 2 0v3a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1Z"/>
                </svg>
                <span>{uploading ? 'Uploading…' : 'Upload to local storage'}</span>
              </button>
              {files.length>0 && <span className="text-sm opacity-75">{files.length} selected</span>}
            </div>
          </div>
        )}
      </section>
      {message && <div className="text-green-700 text-sm">{message}</div>}
      {error && <div className="text-red-600 text-sm">{error}</div>}

      <section className="rounded-lg border bg-white/60 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-medium">Existing Files</h3>
            <span className="text-xs text-gray-600">Total: <span className="font-medium">{existing.length}</span></span>
          </div>
          <button
            type="button"
            className="inline-flex items-center justify-center gap-2 rounded-md bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 text-sm shadow focus:outline-none focus:ring-2 focus:ring-blue-400"
            onClick={() => setShowList(v => !v)}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4 opacity-90">
              <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 0 0 2.573 1.066c1.57-.907 3.356.879 2.45 2.45-.602 1.043-.065 2.36 1.066 2.573 1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 0 0-1.066 2.573c.906 1.57-.88 3.356-2.45 2.45a1.724 1.724 0 0 0-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 0 0-2.573-1.066c-1.57.906-3.356-.88-2.45-2.45a1.724 1.724 0 0 0-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 0 0 1.066-2.573c-.906-1.57.88-3.356 2.45-2.45.9.521 2.047.134 2.573-1.066Z"/>
              <path d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"/>
            </svg>
            {showList ? 'Hide Existing Files' : 'Show Existing Files'}
          </button>
        </div>

        {showList && (
          <div className="mt-3">
            <div className="text-sm text-gray-700 mb-2">
              Total files: <span className="font-medium">{existing.length}</span>
            </div>
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
                      <td className="p-2">
                        <div className="flex justify-end gap-4">
                          <button
                            className="text-blue-600 hover:underline"
                            onClick={() => setPreviewName(name)}
                          >Preview</button>
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
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {previewName && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" onClick={() => setPreviewName(null)}>
          <div
            className="bg-white rounded shadow relative overflow-hidden"
            style={{ width: previewSize.width, height: previewSize.height }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b p-3 select-none cursor-default">
              <div className="font-semibold text-sm">Preview: {previewName}</div>
              <button className="text-sm" onClick={() => setPreviewName(null)}>Close</button>
            </div>
            <div className="p-3 space-y-3 w-full h-[calc(100%-44px)] overflow-auto">
              {(() => {
                const lower = previewName.toLowerCase();
                const src = `http://localhost:4000/files/${encodeURIComponent(previewName)}`;
                if (lower.endsWith('.pdf')) {
                  return <iframe src={src} className="w-full h-full border" />;
                }
                if (/(\.png|\.jpe?g|\.webp|\.gif|\.bmp|\.svg|\.tiff?)$/.test(lower)) {
                  return <img src={src} alt={previewName} className="h-full w-full object-contain" />;
                }
                if (/(\.txt|\.csv|\.json)$/.test(lower)) {
                  // fetch text content lazily via native HTML include
                  return (
                    <iframe src={src} className="w-full h-full border bg-white" />
                  );
                }
                return (
                  <div className="text-sm">
                    Preview not supported. <a className="text-blue-600 underline" href={src} target="_blank">Download</a>
                  </div>
                );
              })()}
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
    </div>
  );
}


