export async function listProviders() {
  const res = await fetch("http://localhost:4000/providers", { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load providers");
  return res.json() as Promise<{ providers: { id: string; kind: string; requires: string[] }[] }>;
}

export async function parseInvoice(providerId: string, file: File) {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch("http://localhost:4000/parse", {
    method: "POST",
    body: fd,
    headers: { "X-Provider-Id": providerId },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function uploadFile(file: File) {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch("http://localhost:4000/upload", { method: "POST", body: fd });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<{ ok: true; path: string; filename: string }>;
}

export async function listFiles() {
  const res = await fetch("http://localhost:4000/files", { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to list files");
  return res.json() as Promise<{ files: string[] }>;
}

export async function deleteFileByName(name: string) {
  const res = await fetch(`http://localhost:4000/files/${encodeURIComponent(name)}`, { method: "DELETE" });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<{ ok: true }>;
}
