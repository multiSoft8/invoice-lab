import { promises as fs } from 'node:fs';
import path from 'node:path';
import { ProcessingResult } from './mcp-client';

export class ResultStorage {
  private resultsDir: string;

  constructor(resultsDir: string) {
    this.resultsDir = resultsDir;
  }

  async ensureResultsDir(): Promise<void> {
    await fs.mkdir(this.resultsDir, { recursive: true });
  }

  async saveResult(result: ProcessingResult): Promise<void> {
    await this.ensureResultsDir();
    const filePath = path.join(this.resultsDir, `processing-${result.id}.json`);
    await fs.writeFile(filePath, JSON.stringify(result, null, 2));
    
    // Update index
    await this.updateIndex(result);
  }

  async getResult(id: string): Promise<ProcessingResult | null> {
    try {
      const filePath = path.join(this.resultsDir, `processing-${id}.json`);
      const content = await fs.readFile(filePath, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      return null;
    }
  }

  async getResultsByFilename(filename: string): Promise<ProcessingResult[]> {
    try {
      const indexPath = path.join(this.resultsDir, 'index.json');
      const content = await fs.readFile(indexPath, 'utf8');
      const index = JSON.parse(content);
      return index[filename] || [];
    } catch (error) {
      return [];
    }
  }

  async getAllResults(): Promise<ProcessingResult[]> {
    try {
      const indexPath = path.join(this.resultsDir, 'index.json');
      const content = await fs.readFile(indexPath, 'utf8');
      const index = JSON.parse(content);
      
      const allResults: ProcessingResult[] = [];
      for (const filename in index) {
        allResults.push(...index[filename]);
      }
      
      return allResults.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } catch (error) {
      return [];
    }
  }

  private async updateIndex(result: ProcessingResult): Promise<void> {
    try {
      const indexPath = path.join(this.resultsDir, 'index.json');
      let index: Record<string, ProcessingResult[]> = {};
      
      try {
        const content = await fs.readFile(indexPath, 'utf8');
        index = JSON.parse(content);
      } catch (error) {
        // Index doesn't exist yet, start with empty object
      }
      
      if (!index[result.filename]) {
        index[result.filename] = [];
      }
      
      // Remove existing result with same ID if it exists
      index[result.filename] = index[result.filename].filter(r => r.id !== result.id);
      
      // Add new result
      index[result.filename].push(result);
      
      // Sort by creation time (newest first)
      index[result.filename].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      await fs.writeFile(indexPath, JSON.stringify(index, null, 2));
    } catch (error) {
      console.error('Failed to update results index:', error);
    }
  }

  async deleteResult(id: string): Promise<boolean> {
    try {
      const filePath = path.join(this.resultsDir, `processing-${id}.json`);
      await fs.unlink(filePath);
      
      // Update index
      const indexPath = path.join(this.resultsDir, 'index.json');
      let index: Record<string, ProcessingResult[]> = {};
      
      try {
        const content = await fs.readFile(indexPath, 'utf8');
        index = JSON.parse(content);
      } catch (error) {
        return true; // Index doesn't exist, nothing to update
      }
      
      // Remove from index
      for (const filename in index) {
        index[filename] = index[filename].filter(r => r.id !== id);
        if (index[filename].length === 0) {
          delete index[filename];
        }
      }
      
      await fs.writeFile(indexPath, JSON.stringify(index, null, 2));
      return true;
    } catch (error) {
      console.error('Failed to delete result:', error);
      return false;
    }
  }
}

