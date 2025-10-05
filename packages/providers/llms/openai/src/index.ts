import type { InvoiceInput, ParsedInvoice, Provider } from "@invoice-lab/core";
import { ParsedInvoiceSchema } from "@invoice-lab/core";

// NOTE: Keep this provider stubbed without importing OpenAI SDK to avoid forcing setup.
// You can replace the stubbed behavior with actual API calls later.

export const OpenAIProvider: Provider = {
  id: "openai-gpt",
  kind: "llm",
  requires: ["OPENAI_API_KEY"],
  async init(config) {
    if (!config.OPENAI_API_KEY) throw new Error("Missing OPENAI_API_KEY");
  },
  async parse(input: InvoiceInput): Promise<ParsedInvoice> {
    // TEMP logic: return a minimal, deterministic structure based on input kind.
    const base = { number: "STUB-OPENAI", raw: { provider: "openai-stub" } } as ParsedInvoice;
    // Validate shape via Zod so downstream is consistent.
    return ParsedInvoiceSchema.parse(base);
  },
};

export default OpenAIProvider;
