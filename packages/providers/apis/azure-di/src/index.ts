import type { InvoiceInput, ParsedInvoice, Provider } from "@invoice-lab/core";

export const AzureDIProvider: Provider = {
  id: "azure-di",
  kind: "api",
  requires: ["AZURE_DI_KEY", "AZURE_DI_ENDPOINT"],
  async init(config) {
    if (!config.AZURE_DI_KEY || !config.AZURE_DI_ENDPOINT) {
      throw new Error("Azure DI: Missing AZURE_DI_KEY or AZURE_DI_ENDPOINT");
    }
  },
  async parse(_input: InvoiceInput): Promise<ParsedInvoice> {
    // TODO: wire Azure Document Intelligence here.
    // This is a stub to keep the skeleton minimal.
    return { number: "STUB-AZURE-DI", raw: { note: "stub" } };
  },
};

export default AzureDIProvider;
