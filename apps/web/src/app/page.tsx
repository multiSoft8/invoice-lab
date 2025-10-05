import FileUploader from "../components/FileUploader";

export default function Page() {
  return (
    <main className="mx-auto max-w-3xl p-6 space-y-6">
      <h1 className="text-2xl font-bold">Upload files to local storage</h1>
      <p className="opacity-80">PDFs and other supported files will be saved under <code>data/invoices/</code>.</p>
      <FileUploader />
    </main>
  );
}
