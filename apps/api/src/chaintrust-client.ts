import FormData from 'form-data';

export interface ChaintrustExtractResponse {
  task_id: string;
  status: string;
  message?: string;
}

export interface ChaintrustStatusResponse {
  task_id: string;
  status: 'processing' | 'completed' | 'failed';
  result?: any;
  error?: string;
}

export class ChaintrustClient {
  private baseUrl: string;
  private apiKey: string;
  
  constructor(baseUrl: string, apiKey: string) {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
  }
  
  async extractInvoice(file: Buffer, filename: string): Promise<ChaintrustExtractResponse> {
    // Try using a different approach - create the multipart body manually
    const boundary = '----formdata-boundary-' + Math.random().toString(36);
    const fileExtension = filename.split('.').pop()?.toLowerCase();
    let contentType = 'application/octet-stream';
    
    if (fileExtension === 'pdf') {
      contentType = 'application/pdf';
    } else if (['png', 'jpg', 'jpeg'].includes(fileExtension || '')) {
      contentType = `image/${fileExtension}`;
    }
    
    // Create multipart body manually
    const multipartBody = [
      `--${boundary}`,
      `Content-Disposition: form-data; name="file"; filename="${filename}"`,
      `Content-Type: ${contentType}`,
      '',
      file.toString('binary'),
      `--${boundary}--`
    ].join('\r\n');
    
    console.log(`Sending file: ${filename}, Content-Type: ${contentType}, Size: ${file.length} bytes`);
    console.log(`API Key: ${this.apiKey.substring(0, 10)}...`);
    
    const response = await fetch(`${this.baseUrl}/invoice/extract`, {
      method: 'POST',
      headers: {
        'X-API-Key': this.apiKey,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': Buffer.byteLength(multipartBody, 'binary').toString()
      },
      body: Buffer.from(multipartBody, 'binary')
    });
    
    console.log(`Response status: ${response.status} ${response.statusText}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.log(`Error response body: ${errorText}`);
      throw new Error(`Chaintrust API error: ${response.status} ${response.statusText} - ${errorText}`);
    }
    
    return await response.json();
  }
  
  async getStatus(taskId: string): Promise<ChaintrustStatusResponse> {
    const response = await fetch(`${this.baseUrl}/invoice/status/${taskId}`, {
      method: 'GET',
      headers: {
        'X-API-Key': this.apiKey,
      }
    });
    
    console.log(`Status Response status: ${response.status} ${response.statusText}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.log(`Status Error response body: ${errorText}`);
      throw new Error(`Chaintrust status API error: ${response.status} ${response.statusText} - ${errorText}`);
    }
    
    return await response.json();
  }

  async getResult(taskId: string): Promise<any> {
    const response = await fetch(`${this.baseUrl}/invoice/${taskId}/result`, {
      method: 'GET',
      headers: {
        'X-API-Key': this.apiKey,
      }
    });
    
    console.log(`Result Response status: ${response.status} ${response.statusText}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.log(`Result Error response body: ${errorText}`);
      throw new Error(`Chaintrust result API error: ${response.status} ${response.statusText} - ${errorText}`);
    }
    
    return await response.json();
  }
  
  async pollForResults(taskId: string): Promise<any> {
    const maxAttempts = 15; // 50% increase from 10 to 15
    const baseDelayMs = 3000; // 3 seconds base delay
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        console.log(`Polling attempt ${attempt}/${maxAttempts} for task ${taskId}`);
        
        const statusResponse = await this.getStatus(taskId);
        console.log(`Status response:`, statusResponse);
        
        if (statusResponse.status === 'completed') {
          // Task is completed, get the actual results
          console.log(`Task completed, fetching results...`);
          return await this.getResult(taskId);
        } else if (statusResponse.status === 'failed') {
          throw new Error(statusResponse.error || 'Processing failed');
        }
        
        // Still processing, calculate delay with exponential backoff
        if (attempt < maxAttempts) {
          let delayMs = baseDelayMs;
          
          // Increase delay after attempt 5
          if (attempt >= 5) {
            delayMs = baseDelayMs + (attempt - 4) * 1000; // +1s for each attempt after 5
          }
          
          // Cap at 10 seconds for attempt 9
          if (attempt >= 9) {
            delayMs = 10000; // 10 seconds
          }
          
          console.log(`Task still processing, waiting ${delayMs}ms...`);
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
        
      } catch (error: any) {
        console.log(`Polling attempt ${attempt} failed:`, error.message);
        if (attempt === maxAttempts) {
          // Return a graceful message instead of throwing an error
          return {
            status: 'timeout',
            message: 'Invoice processing is not ready yet, please try again later.',
            taskId: taskId,
            attempts: maxAttempts
          };
        }
        
        // Calculate delay for retry
        let delayMs = baseDelayMs;
        if (attempt >= 5) {
          delayMs = baseDelayMs + (attempt - 4) * 1000;
        }
        if (attempt >= 9) {
          delayMs = 10000;
        }
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
    
    // This should never be reached due to the return in the catch block above
    return {
      status: 'timeout',
      message: 'Invoice processing is not ready yet, please try again later.',
      taskId: taskId,
      attempts: maxAttempts
    };
  }
}
