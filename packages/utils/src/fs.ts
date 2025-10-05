import { promises as fs } from "node:fs";
import path from "node:path";

export async function ensureDir(p: string) {
  await fs.mkdir(p, { recursive: true });
}

export async function writeBytes(filePath: string, bytes: Uint8Array) {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, Buffer.from(bytes));
}
