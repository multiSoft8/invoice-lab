import Fastify from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import path from "node:path";
import { promises as fs } from "node:fs";
import { CONFIG } from "./config";
import { listProviders, getProvider } from "./providers";

const app = Fastify({ logger: true });
app.register(cors, { origin: true });
app.register(multipart);

app.get("/health", async () => ({ ok: true }));

app.get("/providers", async () => ({ providers: listProviders() }));

app.post("/parse", async (req, reply) => {
  const mp = await (req as any).file();
  const providerId = (req as any).headers["x-provider-id"] as string | undefined;
  if (!providerId) return reply.code(400).send({ error: "Missing X-Provider-Id header" });
  if (!mp) return reply.code(400).send({ error: "Expected multipart/form-data with a file field" });

  // Save file to local data dir for reproducibility
  const uploadDir = path.resolve(__dirname, CONFIG.uploadDir);
  await fs.mkdir(uploadDir, { recursive: true });
  const filePath = path.join(uploadDir, mp.filename);
  await fs.writeFile(filePath, await mp.toBuffer());

  const provider = await getProvider(providerId);
  const result = await provider.parse({ kind: "file", path: filePath });
  return { providerId, result };
});

app.listen(CONFIG.port, "0.0.0.0").then(() => {
  app.log.info(`API on http://localhost:${CONFIG.port}`);
});
