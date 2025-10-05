import { z } from "zod";

export const LineItem = z.object({
  description: z.string().optional(),
  qty: z.number().optional(),
  unitPrice: z.number().optional(),
  vatRate: z.number().optional(),
  total: z.number().optional(),
});

export const ParsedInvoiceSchema = z.object({
  supplier: z.string().optional(),
  customer: z.string().optional(),
  number: z.string().optional(),
  issueDate: z.string().optional(),
  currency: z.string().optional(),
  totals: z
    .object({
      net: z.number().optional(),
      vat: z.number().optional(),
      gross: z.number().optional(),
    })
    .optional(),
  lines: z.array(LineItem).optional(),
  raw: z.unknown().optional(),
});

export type ParsedInvoice = z.infer<typeof ParsedInvoiceSchema>;

export type InvoiceInput =
  | { kind: "file"; path: string }
  | { kind: "buffer"; bytes: Uint8Array; filename?: string }
  | { kind: "xml"; content: string };

export type ProviderKind = "api" | "llm";

export interface Provider {
  id: string;
  kind: ProviderKind;
  requires: string[]; // env var names
  init(config: Record<string, string | undefined>): Promise<void>;
  parse(input: InvoiceInput): Promise<ParsedInvoice>;
}

export const ProviderInfoSchema = z.object({
  id: z.string(),
  kind: z.union([z.literal("api"), z.literal("llm")]),
  requires: z.array(z.string()),
});

export type ProviderInfo = z.infer<typeof ProviderInfoSchema>;
