// SmartSCan API Client - Async Transaction-based Approach
// Correct endpoints: /v1/transactions, /v1/transactions/{id}/status, /v1/transactions/{id}/results

export interface SmartScanTransactionRequest {
  document: {
    source: {
      httpUri?: string;
    };
    content?: string; // base64 encoded content
  };
  features: string[]; // Array of feature strings
  tags?: string[]; // Optional tags
  customId?: string; // Optional custom ID
}

export interface SmartScanTransactionResponse {
  id: string;
  customId: string;
}


export interface SmartScanStatusResponse {
  id: string;
  status: 'CREATED' | 'RUNNING' | 'DONE' | 'FAILED';
  customId: string;
}

export interface SmartScanResultsResponse {
  // Final results structure (to be determined from API docs)
  [key: string]: any;
}

export class SmartScanClient {
  private baseUrl: string;
  private apiKey: string;

  constructor(baseUrl: string, apiKey: string) {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
  }

  async processDocument(fileData: Buffer, filename: string): Promise<any> {
    console.log(`\n=== SmartSCan Async Processing Started ===`);
    console.log(`📄 Document: ${filename}`);
    console.log(`🔗 Base URL: ${this.baseUrl}`);
    console.log(`🔑 API Key: ${this.apiKey ? `${this.apiKey.substring(0, 8)}...${this.apiKey.substring(this.apiKey.length - 4)}` : 'NOT SET'}`);
    console.log(`📊 File size: ${fileData.length} bytes`);
    
    // Step 1: Convert file to base64
    console.log(`\n📋 Step 1: Converting file to base64...`);
    const base64Content = fileData.toString('base64');
    console.log(`✅ Base64 conversion completed`);
    console.log(`📏 Base64 length: ${base64Content.length} characters`);
    console.log(`📏 Base64 preview: ${base64Content.substring(0, 50)}...`);
    
    // Step 2: Validate file type
    console.log(`\n📋 Step 2: Validating file type...`);
    const fileExtension = filename.split('.').pop()?.toLowerCase();
    const supportedTypes = ['pdf', 'jpg', 'jpeg', 'png', 'bmp', 'webp', 'tif', 'gif', 'heif', 'heic'];
    console.log(`🔍 File extension: ${fileExtension}`);
    console.log(`📝 Supported types: ${supportedTypes.join(', ')}`);
    
    if (!supportedTypes.includes(fileExtension || '')) {
      console.log(`❌ File type validation failed`);
      throw new Error(`Unsupported file type: ${fileExtension}. Supported types: ${supportedTypes.join(', ')}`);
    }
    console.log(`✅ File type validation passed`);

    // Step 3: Create transaction
    console.log(`\n📋 Step 3: Creating SmartSCan transaction...`);
    const transactionResponse = await this.createTransaction(base64Content);
    console.log(`✅ Transaction created successfully`);
    console.log(`🆔 Transaction ID: ${transactionResponse.id}`);
    
        // Step 4: Poll for results
        console.log(`\n📋 Step 4: Polling for transaction results...`);
        const results = await this.pollForResults(transactionResponse.id);
        console.log(`✅ Transaction completed successfully`);

        return results;
  }

  async createTransaction(base64Content: string): Promise<SmartScanTransactionResponse> {
    console.log(`\n📋 Creating SmartSCan transaction...`);
    
    // Prepare request body with all available features
    const requestBody: SmartScanTransactionRequest = {
      document: {
        content: base64Content
      },
      features: [
        "BANK_ACCOUNT_NUMBER",
        "BANK_REGISTRATION_NUMBER",
        "BIC",
        "CREDIT_CARD_LAST_FOUR",
        "CURRENCY",
        "CUSTOMER_NUMBER",
        "DOCUMENT_DATE",
        "DOCUMENT_NUMBER",
        "DOCUMENT_TYPE",
        "IBAN",
        "ORDER_NUMBER",
        "OCR_LINE_BE_PAYMENT_ID",
        "OCR_LINE_DK_CREDITOR_ID",
        "OCR_LINE_DK_PAYMENT_ID",
        "OCR_LINE_DK_TYPE",
        "OCR_LINE_FI_PAYMENT_ID",
        "OCR_LINE_NL_PAYMENT_ID",
        "OCR_LINE_NO_PAYMENT_ID",
        "OCR_LINE_SE_BANKGIRO_CREDITOR_ID",
        "OCR_LINE_SE_PAYMENT_ID",
        "OCR_LINE_SE_PLUSGIRO_CREDITOR_ID",
        "PAYMENT_DUE_DATE",
        "PAYMENT_METHOD",
        "PURCHASE_LINES",
        "RECEIVER_ADDRESS",
        "RECEIVER_COUNTRY_CODE",
        "RECEIVER_NAME",
        "RECEIVER_ORDER_NUMBER",
        "RECEIVER_VAT_NUMBER",
        "SUPPLIER_ADDRESS",
        "SUPPLIER_COUNTRY_CODE",
        "SUPPLIER_ORGANISATION_NUMBER",
        "SUPPLIER_NAME",
        "SUPPLIER_VAT_NUMBER",
        "TEXT_ANNOTATION",
        "TOTAL_EXCL_VAT",
        "TOTAL_INCL_VAT",
        "TOTAL_VAT",
        "VAT_DISTRIBUTION",
        "PAGE_TEXTS",
        "QR_CODES",
        "SWISS_QR_BILLS"
      ],
      tags: ["invoice-lab"],
      customId: `invoice-${Date.now()}`
    };
    
    const requestBodyJson = JSON.stringify(requestBody);
    console.log(`✅ Request body prepared`);
    console.log(`📏 Request body size: ${requestBodyJson.length} characters`);
    console.log(`📝 Request structure:`, {
      document: { content: `[${base64Content.length} chars]` },
      features: `${requestBody.features.length} features`,
      tags: requestBody.tags,
      customId: requestBody.customId
    });

    // Prepare headers
    const headers = {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'User-Agent': 'InvoiceLab/1.0'
    };
    console.log(`✅ Headers prepared`);
    console.log(`🔑 Authorization header: Bearer ${this.apiKey ? `${this.apiKey.substring(0, 8)}...${this.apiKey.substring(this.apiKey.length - 4)}` : 'NOT SET'}`);
    console.log(`📄 Content-Type: application/json`);
    console.log(`📄 Accept: application/json`);
    console.log(`📄 User-Agent: InvoiceLab/1.0`);

    // Construct full URL
    const fullUrl = `${this.baseUrl}/v1/transactions`;
    console.log(`✅ Full URL constructed`);
    console.log(`🌐 Full URL: ${fullUrl}`);

    // Make API call
    console.log(`\n📋 Making POST request to create transaction...`);
    console.log(`🚀 Sending POST request to: ${fullUrl}`);
    console.log(`📤 Request payload size: ${requestBodyJson.length} bytes`);
    
    const startTime = Date.now();
    const response = await fetch(fullUrl, {
      method: 'POST',
      headers: headers,
      body: requestBodyJson
    });
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    console.log(`⏱️  API call completed in ${duration}ms`);
    console.log(`📊 Response status: ${response.status} ${response.statusText}`);
    console.log(`📋 Response headers:`, Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      console.log(`❌ Transaction creation failed`);
      const errorText = await response.text();
      console.log(`📄 Error response body: ${errorText}`);
      console.log(`📄 Error response headers:`, Object.fromEntries(response.headers.entries()));
      throw new Error(`SmartSCan transaction creation failed: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const result: SmartScanTransactionResponse = await response.json();
    console.log(`✅ Transaction response parsed successfully`);
    console.log(`📄 Transaction response:`, JSON.stringify(result, null, 2));
    
    return result;
  }


  async getTransactionStatus(transactionId: string): Promise<SmartScanStatusResponse> {
    console.log(`\n📋 Getting transaction status for ID: ${transactionId}`);

    const headers = {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json'
    };

    const fullUrl = `${this.baseUrl}/v1/transactions/${transactionId}/status`;
    console.log(`🌐 Status URL: ${fullUrl}`);

    const response = await fetch(fullUrl, {
      method: 'GET',
      headers: headers
    });

    console.log(`📊 Status response: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.log(`❌ Status retrieval failed: ${errorText}`);
      throw new Error(`SmartSCan status retrieval failed: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const result: SmartScanStatusResponse = await response.json();
    console.log(`✅ Status response parsed successfully`);
    console.log(`📄 Status response:`, JSON.stringify(result, null, 2));

    return result;
  }

  async getTransactionResults(transactionId: string): Promise<SmartScanResultsResponse> {
    console.log(`\n📋 Getting transaction results for ID: ${transactionId}`);
    
    const headers = {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json'
    };
    
    const fullUrl = `${this.baseUrl}/v1/transactions/${transactionId}/results`;
    console.log(`🌐 Results URL: ${fullUrl}`);
    
    const response = await fetch(fullUrl, {
      method: 'GET',
      headers: headers
    });
    
    console.log(`📊 Results response: ${response.status} ${response.statusText}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.log(`❌ Results retrieval failed: ${errorText}`);
      throw new Error(`SmartSCan results retrieval failed: ${response.status} ${response.statusText} - ${errorText}`);
    }
    
    const result: SmartScanResultsResponse = await response.json();
    console.log(`✅ Results response parsed successfully`);
    console.log(`📄 Results response:`, JSON.stringify(result, null, 2));
    
    return result;
  }

  async pollForResults(transactionId: string): Promise<any> {
    const maxAttempts = 20; // Increased from 15 to 20
    const baseDelayMs = 3000; // 3 seconds base delay

    console.log(`\n📋 Starting status polling for transaction: ${transactionId}`);
    console.log(`⏱️  Max attempts: ${maxAttempts}`);
    console.log(`⏱️  Base delay: ${baseDelayMs}ms`);

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        console.log(`\n📋 Polling attempt ${attempt}/${maxAttempts} for transaction ${transactionId}`);

        // Step 1: Check transaction status
        const statusResponse = await this.getTransactionStatus(transactionId);
        console.log(`📊 Transaction status: ${statusResponse.status}`);

        if (statusResponse.status === 'DONE') {
          // Step 2: Get actual results when status is DONE
          console.log(`✅ Transaction completed, fetching results...`);
          const results = await this.getTransactionResults(transactionId);
          console.log(`✅ Results retrieved successfully`);
          return results;
        } else if (statusResponse.status === 'FAILED') {
          throw new Error(`Transaction failed: ${statusResponse.status}`);
        } else {
          console.log(`⏳ Transaction status: ${statusResponse.status}, waiting...`);
        }

        if (attempt === maxAttempts) {
          console.log(`⏰ Max attempts reached, returning timeout response`);
          return {
            status: 'timeout',
            message: 'SmartSCan processing is not ready yet, please try again later.',
            transactionId: transactionId,
            attempts: maxAttempts
          };
        }

        // Calculate delay for retry with incremental increase
        let delayMs = baseDelayMs;
        if (attempt >= 2) {
          delayMs = baseDelayMs + (attempt - 1) * 1000; // +1s for each attempt
        }
        if (delayMs > 10000) {
          delayMs = 10000;
        }

        console.log(`⏳ Retrying in ${delayMs}ms...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));

      } catch (error: any) {
        console.log(`❌ Polling attempt ${attempt} failed:`, error.message);
        
        // Check if it's a 404 or similar error that means "not ready yet"
        if (error.message.includes('404') || error.message.includes('not found') || error.message.includes('not ready')) {
          console.log(`⏳ Transaction not ready yet, will retry...`);
        } else {
          console.log(`❌ Unexpected error:`, error.message);
        }

        if (attempt === maxAttempts) {
          console.log(`⏰ Max attempts reached, returning timeout response`);
          return {
            status: 'timeout',
            message: 'SmartSCan processing is not ready yet, please try again later.',
            transactionId: transactionId,
            attempts: maxAttempts
          };
        }

        // Calculate delay for retry with incremental increase
        let delayMs = baseDelayMs;
        if (attempt >= 2) {
          delayMs = baseDelayMs + (attempt - 1) * 1000; // +1s for each attempt
        }
        if (delayMs > 10000) {
          delayMs = 10000;
        }

        console.log(`⏳ Retrying in ${delayMs}ms...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }

    // This should never be reached due to the return in the catch block above
    return {
      status: 'timeout',
      message: 'SmartSCan processing is not ready yet, please try again later.',
      transactionId: transactionId,
      attempts: maxAttempts
    };
  }
}
