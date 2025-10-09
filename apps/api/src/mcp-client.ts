import { randomUUID } from 'node:crypto';

export interface ClientInfo {
  businessId: string;  // VAT123456789 format
  name: string;         // Client business name
  country: string;      // ISO country code (FI, SE, NO, US, etc.)
}

export interface MCPInitializeResponse {
  jsonrpc: string;
  id: number;
  result: {
    protocolVersion: string;
    capabilities: any;
    serverInfo: {
      name: string;
      version: string;
    };
  };
}

export interface MCPToolResponse {
  jsonrpc: string;
  id: number;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

export interface StructurizeDocumentParams {
  client: ClientInfo;
  data?: string;           // Base64 encoded file data
  fileUri?: string;        // Alternative: public URL
  mimeType: 'application/pdf' | 'image/jpeg' | 'image/png';
}

export interface ProcessingResult {
  id: string;                    // Unique processing identifier
  filename: string;              // Original invoice filename
  configId: string;              // MCP configuration used
  clientInfo: ClientInfo;       // Client information
  status: 'processing' | 'completed' | 'failed';
  result?: any;                 // Structured invoice data
  error?: string;               // Error message if failed
  createdAt: string;            // Processing start time
  completedAt?: string;         // Processing completion time
  duration?: number;            // Processing duration in ms
  mcpResponse?: any;           // Raw MCP response for debugging
}

export class MCPClient {
  private url: string;
  private requestId: number = 0;
  private initialized: boolean = false;
  private timeout: number; // Timeout in milliseconds

  constructor(url: string, timeoutSeconds: number = 60) {
    this.url = url;
    this.timeout = timeoutSeconds * 1000; // Convert seconds to milliseconds
  }

  private getNextId(): number {
    return ++this.requestId;
  }

  async initialize(): Promise<MCPInitializeResponse> {
    const response = await fetch(this.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream'
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: this.getNextId(),
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
            name: 'invoice-lab',
            version: '1.0.0'
          }
        }
      }),
      signal: AbortSignal.timeout(Math.min(this.timeout / 2, 30000)) // Half of tool timeout or 30s max for init
    });

    if (!response.ok) {
      throw new Error(`MCP server error: ${response.status} ${response.statusText}`);
    }

    const responseText = await response.text();
    
    // Handle Server-Sent Events format
    if (responseText.includes('event: message') && responseText.includes('data: ')) {
      const dataMatch = responseText.match(/data: ({.*})/);
      if (dataMatch) {
        try {
          const data = JSON.parse(dataMatch[1]);
          if (data.jsonrpc === '2.0' && data.result) {
            this.initialized = true;
            return data as MCPInitializeResponse;
          }
        } catch (e) {
          throw new Error('Failed to parse MCP initialize response');
        }
      }
    }
    
    // Try to parse as regular JSON
    try {
      const data = JSON.parse(responseText);
      if (data.jsonrpc === '2.0' && data.result) {
        this.initialized = true;
        return data as MCPInitializeResponse;
      }
    } catch (e) {
      throw new Error('Invalid JSON-RPC response from MCP server');
    }

    throw new Error('Invalid MCP server response');
  }

  async callTool(toolName: string, params: any): Promise<MCPToolResponse> {
    if (!this.initialized) {
      await this.initialize();
    }

    const response = await fetch(this.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream'
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: this.getNextId(),
        method: 'tools/call',
        params: {
          name: toolName,
          arguments: params
        }
      }),
      signal: AbortSignal.timeout(this.timeout) // Configurable timeout for tool calls
    });

    if (!response.ok) {
      throw new Error(`MCP tool call error: ${response.status} ${response.statusText}`);
    }

    const responseText = await response.text();
    
    // Handle Server-Sent Events format
    if (responseText.includes('event: message') && responseText.includes('data: ')) {
      const dataMatch = responseText.match(/data: ({.*})/);
      if (dataMatch) {
        try {
          return JSON.parse(dataMatch[1]) as MCPToolResponse;
        } catch (e) {
          throw new Error('Failed to parse MCP tool response');
        }
      }
    }
    
    // Try to parse as regular JSON
    try {
      return JSON.parse(responseText) as MCPToolResponse;
    } catch (e) {
      throw new Error('Invalid JSON-RPC response from MCP tool call');
    }
  }

  async processInvoice(fileData: Buffer, filename: string, clientInfo: ClientInfo): Promise<any> {
    // Determine MIME type from filename
    const mimeType = this.getMimeType(filename);
    
    // Convert file to base64
    const base64Data = fileData.toString('base64');
    
    // Prepare parameters for structurize_document tool
    const params: StructurizeDocumentParams = {
      client: clientInfo,
      data: base64Data,
      mimeType: mimeType
    };

    // Call the structurize_document tool
    const response = await this.callTool('structurize_document', params);
    
    if (response.error) {
      throw new Error(`MCP tool error: ${response.error.message}`);
    }

    return response.result;
  }

  private getMimeType(filename: string): 'application/pdf' | 'image/jpeg' | 'image/png' {
    const lower = filename.toLowerCase();
    if (lower.endsWith('.pdf')) {
      return 'application/pdf';
    } else if (lower.endsWith('.png')) {
      return 'image/png';
    } else if (lower.match(/\.(jpg|jpeg)$/)) {
      return 'image/jpeg';
    } else {
      // Default to PNG for other image formats
      return 'image/png';
    }
  }
}

