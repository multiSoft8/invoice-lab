export async function listProviders() {
  const res = await fetch("http://localhost:4000/providers", { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load providers");
  return res.json() as Promise<{ providers: { id: string; kind: string; requires: string[] }[] }>;
}

export async function parseInvoice(providerId: string, file: File) {
  // Client-side file size validation (50MB limit)
  const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`File size (${Math.round(file.size / 1024)}KB) exceeds the maximum allowed size of ${Math.round(MAX_FILE_SIZE / 1024 / 1024)}MB`);
  }
  
  // Client-side file type validation
  const allowedTypes = ['.pdf', '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.tiff', '.tif'];
  const fileExt = '.' + file.name.split('.').pop()?.toLowerCase();
  if (!allowedTypes.includes(fileExt)) {
    throw new Error(`File type ${fileExt} is not allowed. Supported types: ${allowedTypes.join(', ')}`);
  }
  
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch("http://localhost:4000/parse", {
    method: "POST",
    body: fd,
    headers: { "X-Provider-Id": providerId },
  });
  
  if (!res.ok) {
    try {
      const errorData = await res.json();
      throw new Error(errorData.message || errorData.error || await res.text());
    } catch {
      throw new Error(`Parse failed with status ${res.status}: ${res.statusText}`);
    }
  }
  
  return res.json();
}

export async function uploadFile(file: File) {
  // Client-side file size validation (50MB limit)
  const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`File size (${Math.round(file.size / 1024)}KB) exceeds the maximum allowed size of ${Math.round(MAX_FILE_SIZE / 1024 / 1024)}MB`);
  }
  
  // Client-side file type validation
  const allowedTypes = ['.pdf', '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.tiff', '.tif'];
  const fileExt = '.' + file.name.split('.').pop()?.toLowerCase();
  if (!allowedTypes.includes(fileExt)) {
    throw new Error(`File type ${fileExt} is not allowed. Supported types: ${allowedTypes.join(', ')}`);
  }
  
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch("http://localhost:4000/upload", { method: "POST", body: fd });
  
  if (!res.ok) {
    try {
      const errorData = await res.json();
      throw new Error(errorData.message || errorData.error || await res.text());
    } catch {
      throw new Error(`Upload failed with status ${res.status}: ${res.statusText}`);
    }
  }
  
  return res.json() as Promise<{ ok: true; path: string; filename: string; size: number; sizeFormatted: string }>;
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

// Processing method configurations
export interface ProcessingConfig {
  id: string;
  name: string;
  method: 'LLM' | 'API' | 'MCP';
  apiKey: string;
  url: string;
  timeout?: number;  // Timeout in seconds (optional, defaults to 60 for MCP)
  createdAt: string;
  updatedAt: string;
}

export async function getConfigs() {
  const res = await fetch("http://localhost:4000/configs", { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load configurations");
  return res.json() as Promise<{ configs: ProcessingConfig[] }>;
}

export async function createConfig(config: Omit<ProcessingConfig, 'id' | 'createdAt' | 'updatedAt'>) {
  const res = await fetch("http://localhost:4000/configs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(config),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<{ ok: true; config: ProcessingConfig }>;
}

export async function updateConfig(id: string, config: Omit<ProcessingConfig, 'id' | 'createdAt' | 'updatedAt'>) {
  const res = await fetch(`http://localhost:4000/configs/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(config),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<{ ok: true; config: ProcessingConfig }>;
}

export async function deleteConfig(id: string) {
  const res = await fetch(`http://localhost:4000/configs/${encodeURIComponent(id)}`, { method: "DELETE" });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<{ ok: true }>;
}

// Connection testing
export interface ConnectionTestResult {
  success: boolean;
  method: 'LLM' | 'API' | 'MCP';
  error: string | null;
  duration: number;
  timestamp: string;
  details: {
    statusCode?: number;
    errorType?: 'auth' | 'network' | 'timeout' | 'invalid_url' | 'unknown';
  };
}

export async function testConnection(configId: string) {
  const res = await fetch(`http://localhost:4000/configs/${encodeURIComponent(configId)}/test-connection`, {
    method: "POST",
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<ConnectionTestResult>;
}

// MCP Processing
export interface ClientInfo {
  businessId: string;  // VAT123456789 format
  name: string;         // Client business name
  country: string;      // ISO country code (FI, SE, NO, US, etc.)
}

export interface MCPProcessRequest {
  filename: string;
  configId: string;
  clientInfo: ClientInfo;
}

export interface MCPProcessResponse {
  success: boolean;
  processingId: string;
  result?: any;
  error?: string;
  duration?: number;
  timestamp: string;
}

export interface ProcessingResult {
  id: string;
  filename: string;
  configId: string;
  clientInfo: ClientInfo;
  status: 'processing' | 'completed' | 'failed';
  result?: any;
  error?: string;
  createdAt: string;
  completedAt?: string;
  duration?: number;
  mcpResponse?: any;
}

export async function processInvoiceWithMCP(request: MCPProcessRequest) {
  const res = await fetch("http://localhost:4000/process-mcp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<MCPProcessResponse>;
}

export async function getProcessingResult(id: string) {
  const res = await fetch(`http://localhost:4000/results/${encodeURIComponent(id)}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<{ result: ProcessingResult }>;
}

export async function getProcessingResultsByFilename(filename: string) {
  const res = await fetch(`http://localhost:4000/results/filename/${encodeURIComponent(filename)}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<{ results: ProcessingResult[] }>;
}

export async function getAllProcessingResults() {
  const res = await fetch("http://localhost:4000/results");
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<{ results: ProcessingResult[] }>;
}

export async function deleteProcessingResult(id: string) {
  const res = await fetch(`http://localhost:4000/results/${encodeURIComponent(id)}`, { method: "DELETE" });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<{ success: boolean }>;
}

// Client Information Management
export async function getClientInfo() {
  const res = await fetch("http://localhost:4000/client-info", { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load client information");
  const data = await res.json() as Promise<{ clientInfo: ClientInfo | null }>;
  return data.clientInfo;
}

export async function updateClientInfo(clientInfo: ClientInfo) {
  const res = await fetch("http://localhost:4000/client-info", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(clientInfo),
  });
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(errorText);
  }
  const data = await res.json() as Promise<{ ok: boolean; clientInfo: ClientInfo }>;
  return data.clientInfo;
}

export async function clearClientInfo() {
  const res = await fetch("http://localhost:4000/client-info", { method: "DELETE" });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<{ ok: boolean }>;
}

// API Processing
export interface APIProcessRequest {
  filename: string;
  configId: string;
}

export interface APIProcessResponse {
  success: boolean;
  taskId: string;
  result?: any;
  error?: string;
  filename: string;
  configName: string;
}

export async function processInvoiceWithAPI(request: APIProcessRequest): Promise<APIProcessResponse> {
  const res = await fetch("http://localhost:4000/process-api", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
  
  if (!res.ok) {
    try {
      const errorData = await res.json();
      throw new Error(errorData.error || await res.text());
    } catch {
      throw new Error(`API processing failed with status ${res.status}: ${res.statusText}`);
    }
  }
  
  return res.json() as Promise<APIProcessResponse>;
}
