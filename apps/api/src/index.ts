import Fastify from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import path from "node:path";
import { createReadStream, promises as fs } from "node:fs";
import { randomUUID } from "node:crypto";
import { CONFIG } from "./config";
import { listProviders, getProvider } from "./providers";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

app.post("/upload", async (req, reply) => {
  const mp = await (req as any).file();
  if (!mp) return reply.code(400).send({ error: "Expected multipart/form-data with a file field" });
  const uploadDir = path.resolve(__dirname, CONFIG.uploadDir);
  await fs.mkdir(uploadDir, { recursive: true });
  const filePath = path.join(uploadDir, mp.filename);
  await fs.writeFile(filePath, await mp.toBuffer());
  return { ok: true, path: filePath, filename: mp.filename };
});

app.get("/files", async () => {
  const uploadDir = path.resolve(__dirname, CONFIG.uploadDir);
  try {
    const entries = await fs.readdir(uploadDir, { withFileTypes: true });
    const files = entries.filter(e => e.isFile()).map(e => e.name);
    return { files };
  } catch {
    return { files: [] };
  }
});

app.get("/files/:name", async (req, reply) => {
  const name = (req.params as any).name as string;
  if (!name || name.includes("..") || name.includes("/")) {
    return reply.code(400).send({ error: "Invalid filename" });
  }
  const uploadDir = path.resolve(__dirname, CONFIG.uploadDir);
  const target = path.join(uploadDir, name);
  try {
    const stat = await fs.stat(target);
    if (!stat.isFile()) return reply.code(404).send({ error: "Not found" });
    const stream = createReadStream(target);
    // naive content type by extension
    const ext = path.extname(name).toLowerCase();
    const type = ext === ".pdf" ? "application/pdf"
      : [".png",".jpg",".jpeg",".webp",".gif",".bmp",".svg",".tif",".tiff"].includes(ext) ? `image/${ext.replace('.', '')}`
      : [".txt",".csv",".json"].includes(ext) ? (ext === ".json" ? "application/json" : "text/plain; charset=utf-8")
      : "application/octet-stream";
    reply.header("Content-Type", type);
    reply.header("Content-Disposition", "inline");
    return reply.send(stream);
  } catch {
    return reply.code(404).send({ error: "Not found" });
  }
});

app.delete("/files/:name", async (req, reply) => {
  const name = (req.params as any).name as string;
  if (!name || name.includes("..") || name.includes("/")) {
    return reply.code(400).send({ error: "Invalid filename" });
  }
  const uploadDir = path.resolve(__dirname, CONFIG.uploadDir);
  const target = path.join(uploadDir, name);
  try {
    await fs.unlink(target);
    return { ok: true };
  } catch (e: any) {
    return reply.code(404).send({ error: "Not found" });
  }
});

// Processing method configurations
const configsDir = path.resolve(__dirname, "../../data/configs");

app.get("/configs", async () => {
  try {
    await fs.mkdir(configsDir, { recursive: true });
    const files = await fs.readdir(configsDir);
    const configs = [];
    for (const file of files) {
      if (file.endsWith('.json')) {
        const content = await fs.readFile(path.join(configsDir, file), 'utf8');
        configs.push(JSON.parse(content));
      }
    }
    return { configs };
  } catch {
    return { configs: [] };
  }
});

app.post("/configs", async (req, reply) => {
  const body = req.body as any;
  const { name, method, apiKey } = body;
  
  if (!name || !method || !apiKey) {
    return reply.code(400).send({ error: "Missing required fields" });
  }
  
  if (!['LLM', 'API'].includes(method)) {
    return reply.code(400).send({ error: "Invalid method type" });
  }
  
  const id = randomUUID();
  const config = {
    id,
    name,
    method,
    apiKey,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  try {
    await fs.mkdir(configsDir, { recursive: true });
    await fs.writeFile(path.join(configsDir, `config-${id}.json`), JSON.stringify(config, null, 2));
    return { ok: true, config };
  } catch (e: any) {
    return reply.code(500).send({ error: "Failed to save configuration" });
  }
});

app.put("/configs/:id", async (req, reply) => {
  const id = (req.params as any).id as string;
  const body = req.body as any;
  const { name, method, apiKey } = body;
  
  if (!name || !method || !apiKey) {
    return reply.code(400).send({ error: "Missing required fields" });
  }
  
  if (!['LLM', 'API'].includes(method)) {
    return reply.code(400).send({ error: "Invalid method type" });
  }
  
  const configPath = path.join(configsDir, `config-${id}.json`);
  
  try {
    const existingContent = await fs.readFile(configPath, 'utf8');
    const existing = JSON.parse(existingContent);
    
    const updated = {
      ...existing,
      name,
      method,
      apiKey,
      updatedAt: new Date().toISOString()
    };
    
    await fs.writeFile(configPath, JSON.stringify(updated, null, 2));
    return { ok: true, config: updated };
  } catch (e: any) {
    return reply.code(404).send({ error: "Configuration not found" });
  }
});

app.delete("/configs/:id", async (req, reply) => {
  const id = (req.params as any).id as string;
  const configPath = path.join(configsDir, `config-${id}.json`);
  
  try {
    await fs.unlink(configPath);
    return { ok: true };
  } catch (e: any) {
    return reply.code(404).send({ error: "Configuration not found" });
  }
});

app.listen(CONFIG.port, "0.0.0.0").then(() => {
  app.log.info(`API on http://localhost:${CONFIG.port}`);
});
