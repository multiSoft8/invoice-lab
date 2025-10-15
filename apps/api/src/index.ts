import Fastify from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import path from "node:path";
import { createReadStream, promises as fs } from "node:fs";
import { randomUUID } from "node:crypto";
import { CONFIG } from "./config";
import { listProviders, getProvider } from "./providers";
import { MCPProcessor } from "./mcp-processor";
import { ClientInfo } from "./mcp-client";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = Fastify({ 
  logger: true,
  bodyLimit: CONFIG.maxFileSize // Set Fastify body limit to match file size limit
});
app.register(cors, { origin: true });
app.register(multipart, {
  limits: {
    fileSize: CONFIG.maxFileSize, // 50MB file size limit
    files: CONFIG.maxFiles, // Maximum number of files
    fieldSize: 1024 * 1024, // 1MB field size limit
    fields: 10, // Maximum number of fields
    parts: CONFIG.maxFiles * 2 // Maximum number of parts (files + fields)
  },
  attachFieldsToBody: false,
  sharedSchemaId: 'MultipartFileType'
});

// Initialize MCP processor
const resultsDir = path.resolve(__dirname, "../../data/results");
const mcpProcessor = new MCPProcessor(resultsDir, path.resolve(__dirname, CONFIG.uploadDir));

app.get("/health", async () => ({ ok: true }));

app.get("/providers", async () => ({ providers: listProviders() }));

app.post("/parse", async (req, reply) => {
  try {
    const mp = await (req as any).file();
    const providerId = (req as any).headers["x-provider-id"] as string | undefined;
    if (!providerId) return reply.code(400).send({ error: "Missing X-Provider-Id header" });
    if (!mp) return reply.code(400).send({ error: "Expected multipart/form-data with a file field" });

    // Validate file size
    const fileBuffer = await mp.toBuffer();
    if (fileBuffer.length > CONFIG.maxFileSize) {
      return reply.code(413).send({ 
        error: "File too large", 
        message: `File size (${Math.round(fileBuffer.length / 1024)}KB) exceeds the maximum allowed size of ${Math.round(CONFIG.maxFileSize / 1024 / 1024)}MB`,
        maxSize: CONFIG.maxFileSize,
        actualSize: fileBuffer.length
      });
    }
    
    // Validate file type
    const allowedTypes = ['.pdf', '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.tiff', '.tif'];
    const fileExt = path.extname(mp.filename).toLowerCase();
    if (!allowedTypes.includes(fileExt)) {
      return reply.code(400).send({ 
        error: "Invalid file type", 
        message: `File type ${fileExt} is not allowed. Supported types: ${allowedTypes.join(', ')}`,
        allowedTypes
      });
    }

    // Save file to local data dir for reproducibility
    const uploadDir = path.resolve(__dirname, CONFIG.uploadDir);
    await fs.mkdir(uploadDir, { recursive: true });
    const filePath = path.join(uploadDir, mp.filename);
    await fs.writeFile(filePath, fileBuffer);

    const provider = await getProvider(providerId);
    const result = await provider.parse({ kind: "file", path: filePath });
    return { 
      providerId, 
      result,
      fileInfo: {
        filename: mp.filename,
        size: fileBuffer.length,
        sizeFormatted: `${Math.round(fileBuffer.length / 1024)}KB`
      }
    };
  } catch (error: any) {
    if (error.code === 'FST_REQ_FILE_TOO_LARGE') {
      return reply.code(413).send({ 
        error: "File too large", 
        message: `File exceeds the maximum allowed size of ${Math.round(CONFIG.maxFileSize / 1024 / 1024)}MB`,
        maxSize: CONFIG.maxFileSize
      });
    }
    return reply.code(500).send({ error: "Parse failed", message: error.message });
  }
});

app.post("/upload", async (req, reply) => {
  try {
    const mp = await (req as any).file();
    if (!mp) return reply.code(400).send({ error: "Expected multipart/form-data with a file field" });
    
    // Validate file size
    const fileBuffer = await mp.toBuffer();
    if (fileBuffer.length > CONFIG.maxFileSize) {
      return reply.code(413).send({ 
        error: "File too large", 
        message: `File size (${Math.round(fileBuffer.length / 1024)}KB) exceeds the maximum allowed size of ${Math.round(CONFIG.maxFileSize / 1024 / 1024)}MB`,
        maxSize: CONFIG.maxFileSize,
        actualSize: fileBuffer.length
      });
    }
    
    // Validate file type
    const allowedTypes = ['.pdf', '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.tiff', '.tif'];
    const fileExt = path.extname(mp.filename).toLowerCase();
    if (!allowedTypes.includes(fileExt)) {
      return reply.code(400).send({ 
        error: "Invalid file type", 
        message: `File type ${fileExt} is not allowed. Supported types: ${allowedTypes.join(', ')}`,
        allowedTypes
      });
    }
    
    const uploadDir = path.resolve(__dirname, CONFIG.uploadDir);
    await fs.mkdir(uploadDir, { recursive: true });
    const filePath = path.join(uploadDir, mp.filename);
    await fs.writeFile(filePath, fileBuffer);
    
    return { 
      ok: true, 
      path: filePath, 
      filename: mp.filename,
      size: fileBuffer.length,
      sizeFormatted: `${Math.round(fileBuffer.length / 1024)}KB`
    };
  } catch (error: any) {
    if (error.code === 'FST_REQ_FILE_TOO_LARGE') {
      return reply.code(413).send({ 
        error: "File too large", 
        message: `File exceeds the maximum allowed size of ${Math.round(CONFIG.maxFileSize / 1024 / 1024)}MB`,
        maxSize: CONFIG.maxFileSize
      });
    }
    return reply.code(500).send({ error: "Upload failed", message: error.message });
  }
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

// Client information storage
const clientDir = path.resolve(__dirname, "../../data/client");
const clientInfoPath = path.join(clientDir, "client-info.json");

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
  const { name, method, apiKey, url, timeout } = body;
  
  if (!name || !method || !apiKey || !url) {
    return reply.code(400).send({ error: "Missing required fields" });
  }
  
  if (!['LLM', 'API', 'MCP'].includes(method)) {
    return reply.code(400).send({ error: "Invalid method type" });
  }
  
  // Validate timeout if provided
  if (timeout !== undefined && (typeof timeout !== 'number' || timeout < 10 || timeout > 300)) {
    return reply.code(400).send({ error: "Timeout must be a number between 10 and 300 seconds" });
  }
  
  const id = randomUUID();
  const config = {
    id,
    name,
    method,
    apiKey,
    url,
    timeout: timeout || (method === 'MCP' ? 60 : undefined), // Default 60s for MCP
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
  const { name, method, apiKey, url, timeout } = body;
  
  if (!name || !method || !apiKey || !url) {
    return reply.code(400).send({ error: "Missing required fields" });
  }
  
  if (!['LLM', 'API', 'MCP'].includes(method)) {
    return reply.code(400).send({ error: "Invalid method type" });
  }
  
  // Validate timeout if provided
  if (timeout !== undefined && (typeof timeout !== 'number' || timeout < 10 || timeout > 300)) {
    return reply.code(400).send({ error: "Timeout must be a number between 10 and 300 seconds" });
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
      url,
      timeout: timeout !== undefined ? timeout : (method === 'MCP' ? 60 : existing.timeout),
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

// Client Information endpoints
app.get("/client-info", async () => {
  try {
    await fs.mkdir(clientDir, { recursive: true });
    const content = await fs.readFile(clientInfoPath, 'utf8');
    const clientInfo = JSON.parse(content);
    return { clientInfo };
  } catch {
    return { clientInfo: null };
  }
});

app.put("/client-info", async (req, reply) => {
  const body = req.body as any;
  const { businessId, name, country } = body;
  
  // Validate required fields
  if (!businessId || !name || !country) {
    return reply.code(400).send({ error: "Missing required fields: businessId, name, country" });
  }
  
  // Validate business ID format (VAT format)
  if (!/^VAT[A-Z0-9]{8,12}$/i.test(businessId.trim())) {
    return reply.code(400).send({ error: "Business ID must be in VAT format (e.g., VAT123456789)" });
  }
  
  // Validate name length
  if (name.trim().length < 2) {
    return reply.code(400).send({ error: "Business name must be at least 2 characters" });
  }
  
  const clientInfo = {
    businessId: businessId.trim().toUpperCase(),
    name: name.trim(),
    country: country.trim(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  try {
    await fs.mkdir(clientDir, { recursive: true });
    
    // Check if file exists to preserve createdAt
    try {
      const existingContent = await fs.readFile(clientInfoPath, 'utf8');
      const existing = JSON.parse(existingContent);
      clientInfo.createdAt = existing.createdAt; // Preserve original creation date
    } catch {
      // File doesn't exist, use new createdAt
    }
    
    await fs.writeFile(clientInfoPath, JSON.stringify(clientInfo, null, 2));
    return { ok: true, clientInfo };
  } catch (e: any) {
    return reply.code(500).send({ error: "Failed to save client information" });
  }
});

app.delete("/client-info", async (req, reply) => {
  try {
    await fs.unlink(clientInfoPath);
    return { ok: true };
  } catch (e: any) {
    return reply.code(404).send({ error: "Client information not found" });
  }
});

// Connection test functions
async function testLLMConnection(apiKey: string): Promise<{ success: boolean; error?: string; details?: any }> {
  try {
    const response = await fetch('https://api.openai.com/v1/models', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      signal: AbortSignal.timeout(10000) // 10 second timeout
    });
    
    if (response.ok) {
      return { success: true, details: { statusCode: response.status } };
    } else {
      return { 
        success: false, 
        error: `OpenAI API error: ${response.status} ${response.statusText}`,
        details: { statusCode: response.status, errorType: 'auth' }
      };
    }
  } catch (error: any) {
    if (error.name === 'TimeoutError') {
      return { success: false, error: 'Request timeout', details: { errorType: 'timeout' } };
    }
    return { success: false, error: error.message, details: { errorType: 'network' } };
  }
}

async function testAPIConnection(url: string, apiKey?: string): Promise<{ success: boolean; error?: string; details?: any }> {
  try {
    // Try health endpoint first, fallback to root
    const healthUrl = url.endsWith('/') ? `${url}health` : `${url}/health`;
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }
    
    let response = await fetch(healthUrl, {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(5000) // 5 second timeout
    });
    
    // If health endpoint fails, try root
    if (!response.ok && response.status === 404) {
      response = await fetch(url, {
        method: 'HEAD',
        headers,
        signal: AbortSignal.timeout(5000)
      });
    }
    
    if (response.ok) {
      return { success: true, details: { statusCode: response.status } };
    } else {
      return { 
        success: false, 
        error: `API error: ${response.status} ${response.statusText}`,
        details: { statusCode: response.status, errorType: 'auth' }
      };
    }
  } catch (error: any) {
    if (error.name === 'TimeoutError') {
      return { success: false, error: 'Request timeout', details: { errorType: 'timeout' } };
    }
    if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      return { success: false, error: 'Service unavailable', details: { errorType: 'network' } };
    }
    return { success: false, error: error.message, details: { errorType: 'network' } };
  }
}

async function testMCPConnection(url: string): Promise<{ success: boolean; error?: string; details?: any }> {
  try {
    // Test MCP server with JSON-RPC initialize method
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream'
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {
            roots: {
              listChanged: true
            },
            sampling: {}
          },
          clientInfo: {
            name: 'invoice-lab-test',
            version: '1.0.0'
          }
        }
      }),
      signal: AbortSignal.timeout(15000) // 15 second timeout for MCP
    });
    
    if (response.ok) {
      const responseText = await response.text();
      
      // Handle Server-Sent Events format
      if (responseText.includes('event: message') && responseText.includes('data: ')) {
        // Extract JSON from SSE format
        const dataMatch = responseText.match(/data: ({.*})/);
        if (dataMatch) {
          try {
            const data = JSON.parse(dataMatch[1]);
            if (data.jsonrpc === '2.0' && data.result) {
              return { 
                success: true, 
                details: { 
                  statusCode: response.status, 
                  jsonrpc: true, 
                  serverInfo: data.result.serverInfo,
                  capabilities: data.result.capabilities
                } 
              };
            }
          } catch (e) {
            // Fallback to generic success if we can't parse
            return { success: true, details: { statusCode: response.status, sse: true } };
          }
        }
      }
      
      // Try to parse as regular JSON
      try {
        const data = JSON.parse(responseText);
        if (data.jsonrpc === '2.0') {
          return { success: true, details: { statusCode: response.status, jsonrpc: true } };
        }
      } catch (e) {
        // Fallback to generic success
        return { success: true, details: { statusCode: response.status } };
      }
      
      return { 
        success: false, 
        error: 'Invalid JSON-RPC response',
        details: { statusCode: response.status, errorType: 'network' }
      };
    } else {
      // Try to parse JSON-RPC error response
      try {
        const errorData = await response.json();
        if (errorData.jsonrpc === '2.0' && errorData.error) {
          return { 
            success: false, 
            error: `MCP error: ${errorData.error.message}`,
            details: { statusCode: response.status, errorType: 'auth', jsonrpcError: errorData.error }
          };
        }
      } catch {
        // Fallback to generic error
      }
      
      return { 
        success: false, 
        error: `MCP server error: ${response.status} ${response.statusText}`,
        details: { statusCode: response.status, errorType: 'network' }
      };
    }
  } catch (error: any) {
    if (error.name === 'TimeoutError') {
      return { success: false, error: 'Request timeout', details: { errorType: 'timeout' } };
    }
    if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      return { success: false, error: 'MCP server unavailable', details: { errorType: 'network' } };
    }
    return { success: false, error: error.message, details: { errorType: 'network' } };
  }
}

// Connection testing endpoint
app.post("/configs/:id/test-connection", async (req, reply) => {
  const id = (req.params as any).id as string;
  const configPath = path.join(configsDir, `config-${id}.json`);
  
  try {
    // Load configuration
    const configContent = await fs.readFile(configPath, 'utf8');
    const config = JSON.parse(configContent);
    
    const startTime = Date.now();
    let result;
    
    // Execute test based on method
    switch (config.method) {
      case 'LLM':
        result = await testLLMConnection(config.apiKey);
        break;
      case 'API':
        result = await testAPIConnection(config.url, config.apiKey);
        break;
      case 'MCP':
        result = await testMCPConnection(config.url);
        break;
      default:
        return reply.code(400).send({ error: "Invalid method type" });
    }
    
    const duration = Date.now() - startTime;
    
    return {
      success: result.success,
      method: config.method,
      error: result.error || null,
      duration,
      timestamp: new Date().toISOString(),
      details: result.details || {}
    };
  } catch (e: any) {
    return reply.code(404).send({ error: "Configuration not found" });
  }
});

// MCP Processing endpoints
app.post("/process-mcp", async (req, reply) => {
  const body = req.body as any;
  const { filename, configId, clientInfo } = body;
  
  if (!filename || !configId || !clientInfo) {
    return reply.code(400).send({ error: "Missing required fields: filename, configId, clientInfo" });
  }
  
  // Validate client info
  if (!clientInfo.businessId || !clientInfo.name || !clientInfo.country) {
    return reply.code(400).send({ error: "Missing required client info: businessId, name, country" });
  }
  
  try {
    // Load MCP configuration
    const configPath = path.join(configsDir, `config-${configId}.json`);
    const configContent = await fs.readFile(configPath, 'utf8');
    const config = JSON.parse(configContent);
    
    if (config.method !== 'MCP') {
      return reply.code(400).send({ error: "Configuration is not an MCP method" });
    }
    
    // Get timeout from config or use default (60 seconds)
    const timeoutSeconds = config.timeout || 60;
    
    // Process invoice through MCP
    const result = await mcpProcessor.processInvoice(filename, configId, config.url, clientInfo, timeoutSeconds);
    
    return {
      success: true,
      processingId: result.id,
      result: result.result,
      duration: result.duration,
      timestamp: result.completedAt
    };
  } catch (error: any) {
    return reply.code(500).send({ 
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

app.get("/results/:id", async (req, reply) => {
  const id = (req.params as any).id as string;
  
  try {
    const result = await mcpProcessor.getResult(id);
    if (!result) {
      return reply.code(404).send({ error: "Processing result not found" });
    }
    
    return { result };
  } catch (error: any) {
    return reply.code(500).send({ error: error.message });
  }
});

app.get("/results/filename/:filename", async (req, reply) => {
  const filename = (req.params as any).filename as string;
  
  try {
    const results = await mcpProcessor.getResultsByFilename(filename);
    return { results };
  } catch (error: any) {
    return reply.code(500).send({ error: error.message });
  }
});

app.get("/results", async (req, reply) => {
  try {
    const results = await mcpProcessor.getAllResults();
    return { results };
  } catch (error: any) {
    return reply.code(500).send({ error: error.message });
  }
});

app.delete("/results/:id", async (req, reply) => {
  const id = (req.params as any).id as string;
  
  try {
    const success = await mcpProcessor.deleteResult(id);
    if (!success) {
      return reply.code(404).send({ error: "Processing result not found" });
    }
    
    return { success: true };
  } catch (error: any) {
    return reply.code(500).send({ error: error.message });
  }
});

app.listen(CONFIG.port, "0.0.0.0").then(() => {
  app.log.info(`API on http://localhost:${CONFIG.port}`);
});
