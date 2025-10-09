import { promises as fs } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { MCPClient, ClientInfo, ProcessingResult } from './mcp-client';
import { ResultStorage } from './result-storage';

export class MCPProcessor {
  private resultStorage: ResultStorage;
  private uploadDir: string;

  constructor(resultsDir: string, uploadDir: string) {
    this.resultStorage = new ResultStorage(resultsDir);
    this.uploadDir = uploadDir;
  }

  async processInvoice(
    filename: string, 
    configId: string, 
    mcpUrl: string, 
    clientInfo: ClientInfo,
    timeoutSeconds?: number
  ): Promise<ProcessingResult> {
    const processingId = randomUUID();
    const startTime = Date.now();
    
    // Create initial processing result
    const result: ProcessingResult = {
      id: processingId,
      filename,
      configId,
      clientInfo,
      status: 'processing',
      createdAt: new Date().toISOString()
    };

    try {
      // Save initial processing state
      await this.resultStorage.saveResult(result);

      // Read the invoice file
      const filePath = path.join(this.uploadDir, filename);
      const fileData = await fs.readFile(filePath);

      // Initialize MCP client with timeout
      const mcpClient = new MCPClient(mcpUrl, timeoutSeconds);
      
      // Process invoice through MCP
      const mcpResponse = await mcpClient.processInvoice(fileData, filename, clientInfo);

      // Update result with success
      const completedResult: ProcessingResult = {
        ...result,
        status: 'completed',
        result: mcpResponse,
        completedAt: new Date().toISOString(),
        duration: Date.now() - startTime,
        mcpResponse: mcpResponse
      };

      await this.resultStorage.saveResult(completedResult);
      return completedResult;

    } catch (error: any) {
      // Update result with error
      const failedResult: ProcessingResult = {
        ...result,
        status: 'failed',
        error: error.message,
        completedAt: new Date().toISOString(),
        duration: Date.now() - startTime
      };

      await this.resultStorage.saveResult(failedResult);
      throw error;
    }
  }

  async getResult(id: string): Promise<ProcessingResult | null> {
    return await this.resultStorage.getResult(id);
  }

  async getResultsByFilename(filename: string): Promise<ProcessingResult[]> {
    return await this.resultStorage.getResultsByFilename(filename);
  }

  async getAllResults(): Promise<ProcessingResult[]> {
    return await this.resultStorage.getAllResults();
  }

  async deleteResult(id: string): Promise<boolean> {
    return await this.resultStorage.deleteResult(id);
  }
}

