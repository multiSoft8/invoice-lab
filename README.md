# Invoice Lab (Monorepo)

Local-first testbed for experimenting with electronic invoice processing via (1) third-party APIs and (2) direct LLM prompting. Frontend = Next.js; Backend = Fastify; Shared types via Zod.

## Quickstart

```bash
pnpm install
pnpm -w dev
```
- Web: http://localhost:3000
- API: http://localhost:4000

## Workspace layout
```
apps/
  web/      # Next.js + Tailwind + shadcn/ui (minimal)
  api/      # Fastify + Zod + file handling, dynamic providers
packages/
  core/     # shared TS types + Zod schemas
  utils/    # file IO, logging helpers
  providers/
    apis/
      azure-di/
    llms/
      openai/
```

## Provider contract
Each provider exports `{ id, kind, requires, init, parse }` matching `Provider` in `@invoice-lab/core`.

## Notes
- This is a skeleton with stubs/TODOs. Extend per provider.
- Store sample invoices under `data/invoices/` (gitignored).
