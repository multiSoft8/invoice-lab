import FileUploader from "../components/FileUploader";

export default function Page() {
  return (
    <main className="mx-auto max-w-5xl p-6 space-y-8">
      {/* 1) Invoices management layer */}
      <section className="rounded border p-4 space-y-3">
        <h2 className="text-xl font-semibold">Invoices</h2>
        <p className="text-sm opacity-75">Upload PDFs or images to store locally under data/invoices/.</p>
        <FileUploader />
      </section>

      {/* 2) Processing method selection (placeholder) */}
      <section className="rounded border p-4 space-y-3">
        <h2 className="text-xl font-semibold">Processing Method</h2>
        <p className="text-sm opacity-75">This section will let you choose the invoice processing method (API or LLM).</p>
      </section>

      {/* 3) Compare section (placeholder) */}
      <section className="rounded border p-4 space-y-3">
        <h2 className="text-xl font-semibold">Compare Outputs</h2>
        <p className="text-sm opacity-75">Here you’ll compare results from different methods on the same invoice.</p>
      </section>

      {/* 4) Scanning section (placeholder) */}
      <section className="rounded border p-4 space-y-3">
        <h2 className="text-xl font-semibold">Scanning & Statistics</h2>
        <p className="text-sm opacity-75">This area will show extracted fields, metrics, and processing statistics.</p>
      </section>
    </main>
  );
}
