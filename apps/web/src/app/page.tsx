import ProviderPicker from "../components/ProviderPicker";

export default function Page() {
  return (
    <main className="mx-auto max-w-3xl p-6 space-y-6">
      <h1 className="text-2xl font-bold">Invoice Lab</h1>
      <p className="opacity-80">Experiment with different invoice processors (APIs vs LLMs). Everything runs locally.</p>
      <ProviderPicker />
    </main>
  );
}
