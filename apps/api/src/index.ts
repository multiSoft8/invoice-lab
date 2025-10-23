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
import { ChaintrustClient } from "./chaintrust-client";
import { SmartScanClient } from "./smartscan-client";
import { ResultStorage } from "./result-storage";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize result storage
const resultsDir = path.resolve(__dirname, "../../data/results");
const resultStorage = new ResultStorage(resultsDir);

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
async function testLLMConnection(url: string): Promise<{ success: boolean; error?: string; details?: any }> {
  try {
    // Test basic connectivity without authentication
    const endpoints = ['/', '/health', '/status'];
    
    for (const endpoint of endpoints) {
      try {
        const testUrl = url.endsWith('/') ? `${url}${endpoint.slice(1)}` : `${url}${endpoint}`;
        
        const response = await fetch(testUrl, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          },
          signal: AbortSignal.timeout(5000) // 5 second timeout
        });
        
        if (response.ok || response.status === 404) {
          // Service is reachable (404 means endpoint doesn't exist but service is running)
          return { 
            success: true, 
            details: { 
              statusCode: response.status, 
              endpoint: endpoint,
              message: 'Service is reachable and running'
            } 
          };
        }
      } catch (endpointError) {
        // Continue to next endpoint
        continue;
      }
    }
    
    // If no endpoint responded successfully, try a simple HEAD request
    try {
      const response = await fetch(url, {
        method: 'HEAD',
        signal: AbortSignal.timeout(5000)
      });
      
      if (response.ok || response.status === 404) {
        return { 
          success: true, 
          details: { 
            statusCode: response.status,
            message: 'Service is reachable and running'
          } 
        };
      }
    } catch (headError) {
      // Fall through to error handling
    }
    
    return { 
      success: false, 
      error: 'Service is not reachable or not responding',
      details: { errorType: 'connectivity' }
    };
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

async function testAPIConnection(url: string): Promise<{ success: boolean; error?: string; details?: any }> {
  try {
    // Test basic connectivity without authentication
    const endpoints = ['/', '/health', '/status'];
    
    for (const endpoint of endpoints) {
      try {
        const testUrl = url.endsWith('/') ? `${url}${endpoint.slice(1)}` : `${url}${endpoint}`;
        
        const response = await fetch(testUrl, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          },
          signal: AbortSignal.timeout(5000) // 5 second timeout
        });
        
        if (response.ok || response.status === 404) {
          // Service is reachable (404 means endpoint doesn't exist but service is running)
          return { 
            success: true, 
            details: { 
              statusCode: response.status, 
              endpoint: endpoint,
              message: 'Service is reachable and running'
            } 
          };
        }
      } catch (endpointError) {
        // Continue to next endpoint
        continue;
      }
    }
    
    // If no endpoint responded successfully, try a simple HEAD request
    try {
      const response = await fetch(url, {
        method: 'HEAD',
        signal: AbortSignal.timeout(5000)
      });
      
      if (response.ok || response.status === 404) {
        return { 
          success: true, 
          details: { 
            statusCode: response.status,
            message: 'Service is reachable and running'
          } 
        };
      }
    } catch (headError) {
      // Fall through to error handling
    }
    
    return { 
      success: false, 
      error: 'Service is not reachable or not responding',
      details: { errorType: 'connectivity' }
    };
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
        result = await testLLMConnection(config.url);
        break;
      case 'API':
        result = await testAPIConnection(config.url);
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

// Statistics endpoint
app.get("/statistics", async (req, reply) => {
  try {
    // Get upload directory
    const uploadDir = path.resolve(__dirname, CONFIG.uploadDir);
    
    // Get all files
    const files = await fs.readdir(uploadDir);
    const invoiceFiles = files.filter(file => 
      ['.pdf', '.png', '.jpg', '.jpeg'].includes(path.extname(file).toLowerCase())
    );

    // Get all results
    const allResults = await mcpProcessor.getAllResults();
    
    // Get all configs
    const configFiles = await fs.readdir(configsDir);
    const configs = [];
    for (const file of configFiles) {
      if (file.endsWith('.json')) {
        const content = await fs.readFile(path.join(configsDir, file), 'utf8');
        configs.push(JSON.parse(content));
      }
    }

    // Build statistics
    const statistics = await Promise.all(invoiceFiles.map(async (filename) => {
      const filePath = path.join(uploadDir, filename);
      const stats = await fs.stat(filePath);
      
      const latestScans: Record<string, any> = {};
      
      // Initialize all methods as 'not_scanned'
      configs.forEach(config => {
        latestScans[config.id] = {
          configName: config.name,
          method: config.method,
          status: 'not_scanned',
          lastScanAt: null,
          result: null,
          error: null
        };
      });

      // Find latest results for this invoice
      const invoiceResults = allResults.filter(result => result.filename === filename);
      
      // Group by configId and find latest
      const resultsByConfig = invoiceResults.reduce((acc, result) => {
        if (!acc[result.configId] || new Date(result.createdAt) > new Date(acc[result.configId].createdAt)) {
          acc[result.configId] = result;
        }
        return acc;
      }, {} as Record<string, any>);

      // Update latest scans
      Object.entries(resultsByConfig).forEach(([configId, result]) => {
        if (latestScans[configId]) {
          latestScans[configId] = {
            configName: configs.find(c => c.id === configId)?.name || 'Unknown',
            method: configs.find(c => c.id === configId)?.method || 'Unknown',
            status: result.status,
            lastScanAt: result.createdAt,
            result: result.result,
            error: result.error
          };
        }
      });

      return {
        filename,
        latestScans
      };
    }));

    return { statistics };
  } catch (error: any) {
    return reply.code(500).send({ error: error.message });
  }
});

// API Processing endpoints
app.post("/process-api", async (req, reply) => {
  const body = req.body as any;
  const { filename, configId } = body;
  
  if (!filename || !configId) {
    return reply.code(400).send({ error: "Missing required fields: filename, configId" });
  }
  
  try {
    // Load configuration
    const configPath = path.join(configsDir, `config-${configId}.json`);
    const configContent = await fs.readFile(configPath, 'utf8');
    const config = JSON.parse(configContent);
    
    if (config.method !== 'API') {
      return reply.code(400).send({ error: "Configuration is not an API method" });
    }
    
    // Check if this is SmartSCan (by name) or regular API
    console.log(`\n🔍 Configuration Detection:`);
    console.log(`📝 Config Name: "${config.name}"`);
    console.log(`🔧 Config Method: "${config.method}"`);
    const isSmartScan = config.name === 'SmartSCan';
    console.log(`🎯 Is SmartSCan: ${isSmartScan}`);
    
    // Read the invoice file
    const uploadDir = path.resolve(__dirname, CONFIG.uploadDir);
    const filePath = path.join(uploadDir, filename);
    const fileData = await fs.readFile(filePath);
    
    if (isSmartScan) {
      // Handle SmartSCan processing
      console.log(`\n=== SmartSCan API Endpoint Processing ===`);
      console.log(`📄 Processing file: ${filename}`);
      console.log(`🔧 Config ID: ${configId}`);
      console.log(`🏷️  Config Name: ${config.name}`);
      console.log(`🔗 Config URL: ${config.url}`);
      console.log(`🔑 Config API Key: ${config.apiKey ? `${config.apiKey.substring(0, 8)}...${config.apiKey.substring(config.apiKey.length - 4)}` : 'NOT SET'}`);
      console.log(`📊 File size: ${fileData.length} bytes`);
      
      console.log(`\n📋 Initializing SmartSCan client...`);
      const smartScanClient = new SmartScanClient(config.url, config.apiKey);
      console.log(`✅ SmartSCan client initialized`);
      
      console.log(`\n📋 Calling SmartSCan processDocument method...`);
      const result = await smartScanClient.processDocument(fileData, filename);
      console.log(`✅ SmartSCan processing completed`);
      
      // Create enhanced result with summary
      console.log(`\n📋 Creating enhanced result with summary...`);
      const summary = smartScanClient.getExtractionSummary(result);
      console.log(`📊 Summary:`, {
        totalFields: summary.totalFields,
        extractedFields: summary.extractedFields.length,
        highConfidenceFields: summary.highConfidenceFields,
        extractionRate: Math.round((summary.extractedFields.length / summary.totalFields) * 100),
        missingFieldsCount: summary.missingFields.length
      });
      
      const enhancedResult = {
        ...result,
        summary: {
          totalFields: summary.totalFields,
          extractedFields: summary.extractedFields.length,
          highConfidenceFields: summary.highConfidenceFields,
          extractionRate: Math.round((summary.extractedFields.length / summary.totalFields) * 100),
          missingFields: summary.missingFields
        },
        processedAt: new Date().toISOString(),
        filename: filename
      };
      console.log(`✅ Enhanced result created`);
      
      // Store the result
      console.log(`\n📋 Preparing result for storage...`);
      const resultId = `smartscan-${result.feedbackId}`;
      const processingResult = {
        id: resultId,
        filename: filename,
        configId: configId,
        clientInfo: { businessId: '', name: '', country: '' },
        status: 'completed',
        result: enhancedResult,
        createdAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        duration: 0
      };
      console.log(`📝 Result ID: ${resultId}`);
      console.log(`📊 Result size: ${JSON.stringify(processingResult).length} characters`);
      
      console.log(`\n📋 Storing result in database...`);
      await resultStorage.saveResult(processingResult);
      console.log(`✅ Result stored successfully`);
      
      // Return success
      console.log(`\n📋 Preparing success response...`);
      const response = {
        success: true,
        feedbackId: result.feedbackId,
        result: enhancedResult,
        filename: filename,
        configName: config.name,
        resultId: resultId
      };
      console.log(`✅ Success response prepared`);
      console.log(`\n=== SmartSCan API Endpoint Processing Completed ===`);
      console.log(`📄 File: ${filename}`);
      console.log(`🆔 Feedback ID: ${result.feedbackId}`);
      console.log(`📊 Extraction Rate: ${enhancedResult.summary.extractionRate}%`);
      console.log(`💾 Result ID: ${resultId}`);
      
      return response;
    }
    
    // Initialize Chaintrust client
    console.log(`\n=== Chaintrust API Endpoint Processing ===`);
    console.log(`📄 Processing file: ${filename}`);
    console.log(`🔧 Config ID: ${configId}`);
    console.log(`🏷️  Config Name: ${config.name}`);
    const chaintrustClient = new ChaintrustClient(config.url, config.apiKey);
    
    // Step 1: POST to /invoice/extract
    const extractResponse = await chaintrustClient.extractInvoice(fileData, filename);
    
    // Step 2: Poll for results with exponential backoff
    const result = await chaintrustClient.pollForResults(extractResponse.task_id);
    
    // Check if the result is a timeout response
    if (result.status === 'timeout') {
      return {
        success: false,
        status: 'timeout',
        message: result.message,
        taskId: extractResponse.task_id,
        filename: filename,
        configName: config.name,
        attempts: result.attempts
      };
    }
    
    // Return success with result
    return {
      success: true,
      taskId: extractResponse.task_id,
      result: result,
      filename: filename,
      configName: config.name
    };
    
  } catch (error: any) {
    console.log(`\n❌ === API Processing Error ===`);
    console.log(`📄 File: ${filename}`);
    console.log(`🔧 Config ID: ${configId}`);
    console.log(`🚨 Error Type: ${error.name || 'Unknown'}`);
    console.log(`📝 Error Message: ${error.message}`);
    console.log(`📊 Error Stack:`, error.stack);
    
    // Check if it's a SmartSCan API error
    if (error.message.includes('SmartSCan API error')) {
      console.log(`🔍 Detected SmartSCan API error - returning 400 Bad Request`);
      return reply.code(400).send({ 
        success: false,
        error: error.message,
        filename: filename
      });
    }
    
    // Check if it's a Chaintrust API error
    if (error.message.includes('Chaintrust API error')) {
      console.log(`🔍 Detected Chaintrust API error - returning 400 Bad Request`);
      return reply.code(400).send({ 
        success: false,
        error: error.message,
        filename: filename
      });
    }
    
    // For other errors, return 500
    console.log(`🔍 Detected internal error - returning 500 Internal Server Error`);
    return reply.code(500).send({ 
      success: false,
      error: error.message,
      filename: filename
    });
  }
});

// SmartSCan Processing endpoint
app.post("/process-smartscan", async (req, reply) => {
  const body = req.body as any;
  const { filename, configId } = body;
  
  if (!filename || !configId) {
    return reply.code(400).send({ error: "Missing required fields: filename, configId" });
  }
  
  try {
    // Load configuration
    const configPath = path.join(configsDir, `config-${configId}.json`);
    const configContent = await fs.readFile(configPath, 'utf8');
    const config = JSON.parse(configContent);
    
    if (config.method !== 'API') {
      return reply.code(400).send({ error: "Configuration is not an API method" });
    }
    
    // Check if this is SmartSCan (by name) or regular API
    console.log(`\n🔍 Configuration Detection:`);
    console.log(`📝 Config Name: "${config.name}"`);
    console.log(`🔧 Config Method: "${config.method}"`);
    const isSmartScan = config.name === 'SmartSCan';
    console.log(`🎯 Is SmartSCan: ${isSmartScan}`);
    
    // Read the invoice file
    const uploadDir = path.resolve(__dirname, CONFIG.uploadDir);
    const filePath = path.join(uploadDir, filename);
    const fileData = await fs.readFile(filePath);
    
    console.log(`\n🎯 Decision Point: isSmartScan = ${isSmartScan}`);
    if (isSmartScan) {
      console.log(`\n=== SmartSCan API Endpoint Processing ===`);
      console.log(`📄 Processing file: ${filename}`);
      console.log(`🔧 Config ID: ${configId}`);
      console.log(`🏷️  Config Name: ${config.name}`);
      console.log(`🔗 Config URL: ${config.url}`);
      console.log(`🔑 Config API Key: ${config.apiKey.substring(0, 8)}...${config.apiKey.substring(config.apiKey.length - 4)}`);
      console.log(`📊 File size: ${fileData.length} bytes`);
      
      // Handle SmartSCan processing
      console.log(`\n📋 Initializing SmartSCan client...`);
      const smartScanClient = new SmartScanClient(config.url, config.apiKey);
      console.log(`✅ SmartSCan client initialized`);
      
      // Process document
      console.log(`\n📋 Calling SmartSCan processDocument method...`);
      const result = await smartScanClient.processDocument(fileData, filename);
      console.log(`✅ SmartSCan processing completed`);
      
      // Create enhanced result with summary
      console.log(`\n📋 Creating enhanced result with summary...`);
      const summary = smartScanClient.getExtractionSummary(result);
      console.log(`📊 Summary:`, {
        totalFields: summary.totalFields,
        extractedFields: summary.extractedFields.length,
        highConfidenceFields: summary.highConfidenceFields,
        extractionRate: Math.round((summary.extractedFields.length / summary.totalFields) * 100),
        missingFieldsCount: summary.missingFields.length
      });
      
      const enhancedResult = {
        ...result,
        summary: {
          totalFields: summary.totalFields,
          extractedFields: summary.extractedFields.length,
          highConfidenceFields: summary.highConfidenceFields,
          extractionRate: Math.round((summary.extractedFields.length / summary.totalFields) * 100),
          missingFields: summary.missingFields
        },
        processedAt: new Date().toISOString(),
        filename: filename
      };
      console.log(`✅ Enhanced result created`);
      
      // Store the result in the result storage system
      console.log(`\n📋 Preparing result for storage...`);
      const resultId = `smartscan-${result.feedbackId}`;
      const processingResult = {
        id: resultId,
        filename: filename,
        configId: configId,
        clientInfo: { businessId: '', name: '', country: '' },
        status: 'completed',
        result: enhancedResult,
        createdAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        duration: 0
      };
      console.log(`📝 Result ID: ${resultId}`);
      console.log(`📊 Result size: ${JSON.stringify(processingResult).length} characters`);
      
      // Store the result
      console.log(`\n📋 Storing result in database...`);
      await resultStorage.saveResult(processingResult);
      console.log(`✅ Result stored successfully`);
      
      // Return success with enhanced result
      console.log(`\n📋 Preparing success response...`);
      const response = {
        success: true,
        feedbackId: result.feedbackId,
        result: enhancedResult,
        filename: filename,
        configName: config.name,
        resultId: resultId
      };
      console.log(`✅ Success response prepared`);
      console.log(`\n=== SmartSCan API Endpoint Processing Completed ===`);
      console.log(`📄 File: ${filename}`);
      console.log(`🆔 Feedback ID: ${result.feedbackId}`);
      console.log(`📊 Extraction Rate: ${enhancedResult.summary.extractionRate}%`);
      console.log(`💾 Result ID: ${resultId}`);
      
      return response;
    } else {
      console.log(`\n=== Chaintrust API Endpoint Processing ===`);
      console.log(`📄 Processing file: ${filename}`);
      console.log(`🔧 Config ID: ${configId}`);
      console.log(`🏷️  Config Name: ${config.name}`);
      console.log(`🔗 Config URL: ${config.url}`);
      console.log(`🔑 Config API Key: ${config.apiKey.substring(0, 8)}...${config.apiKey.substring(config.apiKey.length - 4)}`);
      
      // Handle regular API processing (Chaintrust)
      const chaintrustClient = new ChaintrustClient(config.url, config.apiKey);
      
      // Step 1: POST to /invoice/extract
      const extractResponse = await chaintrustClient.extractInvoice(fileData, filename);
      
      // Step 2: Poll for results with exponential backoff
      const result = await chaintrustClient.pollForResults(extractResponse.task_id);
      
      // Check if the result is a timeout response
      if (result.status === 'timeout') {
        return {
          success: false,
          status: 'timeout',
          message: result.message,
          taskId: extractResponse.task_id,
          filename: filename,
          configName: config.name,
          attempts: result.attempts
        };
      }
      
      // Return success with result
      return {
        success: true,
        taskId: extractResponse.task_id,
        result: result,
        filename: filename,
        configName: config.name
      };
    }
    
  } catch (error: any) {
    console.log(`\n❌ === SmartSCan Processing Error ===`);
    console.log(`📄 File: ${filename}`);
    console.log(`🔧 Config ID: ${configId}`);
    console.log(`🚨 Error Type: ${error.name || 'Unknown'}`);
    console.log(`📝 Error Message: ${error.message}`);
    console.log(`📊 Error Stack:`, error.stack);
    
    // Check if it's a SmartSCan API error (like 401 Unauthorized)
    if (error.message.includes('SmartSCan API error')) {
      console.log(`🔍 Detected SmartSCan API error - returning 400 Bad Request`);
      return reply.code(400).send({ 
        success: false,
        error: error.message,
        filename: filename
      });
    }
    
    // For other errors, return 500
    console.log(`🔍 Detected internal error - returning 500 Internal Server Error`);
    return reply.code(500).send({ 
      success: false,
      error: error.message,
      filename: filename
    });
  }
});

app.listen(CONFIG.port, "0.0.0.0").then(() => {
  app.log.info(`API on http://localhost:${CONFIG.port}`);
});
