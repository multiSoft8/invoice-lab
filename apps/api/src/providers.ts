import type { Provider, ProviderInfo } from "@invoice-lab/core";
import OpenAIProvider from "@invoice-lab/providers/llms/openai";
import AzureDIProvider from "@invoice-lab/providers/apis/azure-di";

const registry: Record<string, Provider> = {
  [OpenAIProvider.id]: OpenAIProvider,
  [AzureDIProvider.id]: AzureDIProvider,
};

export function listProviders(): ProviderInfo[] {
  return Object.values(registry).map((p) => ({ id: p.id, kind: p.kind, requires: p.requires }));
}

export async function getProvider(id: string): Promise<Provider> {
  const p = registry[id];
  if (!p) throw new Error(`Unknown provider: ${id}`);
  // Lazy init with current env each time (simple for a testbed)
  await p.init(process.env as Record<string, string>);
  return p;
}
