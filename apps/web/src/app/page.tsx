"use client";
import FileUploader from "../components/FileUploader";
import ProcessingMethod from "../components/ProcessingMethod";
import { useState } from "react";

export default function Page() {
  const [open, setOpen] = useState<{ invoices: boolean; method: boolean; compare: boolean; scan: boolean }>({ invoices: true, method: true, compare: true, scan: true });
  return (
    <main className="mx-auto max-w-5xl p-6 space-y-8">
      {/* 1) Invoices management layer */}
      <section className="rounded border p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Invoices</h2>
          <button className="text-sm text-blue-600 hover:underline" onClick={() => setOpen(v => ({ ...v, invoices: !v.invoices }))}>
            {open.invoices ? "Hide" : "Show"}
          </button>
        </div>
        {open.invoices && (
          <>
            <p className="text-sm opacity-75">Upload PDFs or images to store locally under data/invoices/.</p>
            <FileUploader />
          </>
        )}
      </section>

      {/* 2) Processing method selection (placeholder) */}
      <section className="rounded border p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Processing Method</h2>
          <button className="text-sm text-blue-600 hover:underline" onClick={() => setOpen(v => ({ ...v, method: !v.method }))}>
            {open.method ? "Hide" : "Show"}
          </button>
        </div>
        {open.method && (
          <ProcessingMethod />
        )}
      </section>

      {/* 3) Compare section (placeholder) */}
      <section className="rounded border p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Compare Outputs</h2>
          <button className="text-sm text-blue-600 hover:underline" onClick={() => setOpen(v => ({ ...v, compare: !v.compare }))}>
            {open.compare ? "Hide" : "Show"}
          </button>
        </div>
        {open.compare && (
          <p className="text-sm opacity-75">Here you’ll compare results from different methods on the same invoice.</p>
        )}
      </section>

      {/* 4) Scanning section (placeholder) */}
      <section className="rounded border p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Scanning & Statistics</h2>
          <button className="text-sm text-blue-600 hover:underline" onClick={() => setOpen(v => ({ ...v, scan: !v.scan }))}>
            {open.scan ? "Hide" : "Show"}
          </button>
        </div>
        {open.scan && (
          <p className="text-sm opacity-75">This area will show extracted fields, metrics, and processing statistics.</p>
        )}
      </section>
    </main>
  );
}
