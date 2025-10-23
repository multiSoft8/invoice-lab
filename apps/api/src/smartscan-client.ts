export interface SmartScanBoundingBox {
  vertices: Array<{
    x: number;
    y: number;
  }>;
  normalizedVertices: Array<{
    x: number;
    y: number;
  }>;
}

export interface SmartScanConfidence {
  level: 'VERY_HIGH' | 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface SmartScanModelMetadata {
  modelName: string;
  modelVer: string;
}

export interface SmartScanFieldValue {
  value: string;
  text?: string;
  confidence: SmartScanConfidence;
  boundingBox?: SmartScanBoundingBox;
  pageRef: number;
  modelMetadata: SmartScanModelMetadata;
}

export interface SmartScanAnswers {
  orderDate?: SmartScanFieldValue[];
  paymentDueDate?: SmartScanFieldValue[];
  currency?: SmartScanFieldValue[];
  totalVat?: SmartScanFieldValue[];
  totalInclVat?: SmartScanFieldValue[];
  totalExclVat?: SmartScanFieldValue[];
  supplierCorporateId?: SmartScanFieldValue[];
  supplierCountryCode?: SmartScanFieldValue[];
  documentType?: SmartScanFieldValue[];
  paymentMethod?: SmartScanFieldValue[];
  invoiceNumber?: SmartScanFieldValue[];
  documentNumber?: SmartScanFieldValue[];
  documentDate?: SmartScanFieldValue[];
  // Additional fields that might be present
  [key: string]: SmartScanFieldValue[] | undefined;
}

export interface SmartScanResponse extends SmartScanAnswers {
  feedbackId: string;
  documentMetadata?: {
    pageCount: number;
  };
}

export interface SmartScanRequest {
  document: {
    content: string; // base64 encoded
  };
  features: Array<{
    type: string;
  }>;
  tier: string;
}

export class SmartScanClient {
  private baseUrl: string;
  private apiKey: string;

  constructor(baseUrl: string, apiKey: string) {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
  }

  async processDocument(fileData: Buffer, filename: string): Promise<SmartScanResponse> {
    console.log(`\n=== SmartSCan Processing Started ===`);
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

    // Step 3: Prepare request body
    console.log(`\n📋 Step 3: Preparing request body...`);
    const requestBody: SmartScanRequest = {
      document: {
        content: base64Content
      },
      features: [
        {
          type: "DEFAULT"
        }
      ],
      tier: "PREMIUM"
    };
    
    const requestBodyJson = JSON.stringify(requestBody);
    console.log(`✅ Request body prepared`);
    console.log(`📏 Request body size: ${requestBodyJson.length} characters`);
    console.log(`📝 Request structure:`, {
      document: { content: `[${base64Content.length} chars]` },
      features: requestBody.features,
      tier: requestBody.tier
    });

    // Step 4: Prepare headers
    console.log(`\n📋 Step 4: Preparing request headers...`);
    const headers = {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json'
    };
    console.log(`✅ Headers prepared`);
    console.log(`🔑 Authorization header: Bearer ${this.apiKey ? `${this.apiKey.substring(0, 8)}...${this.apiKey.substring(this.apiKey.length - 4)}` : 'NOT SET'}`);
    console.log(`📄 Content-Type: application/json`);

    // Step 5: Construct full URL
    console.log(`\n📋 Step 5: Constructing full URL...`);
    const fullUrl = `${this.baseUrl}/v1/document:annotate`;
    console.log(`✅ Full URL constructed`);
    console.log(`🌐 Full URL: ${fullUrl}`);

    // Step 6: Make API call
    console.log(`\n📋 Step 6: Making API call to SmartSCan...`);
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
      console.log(`❌ API call failed`);
      const errorText = await response.text();
      console.log(`📄 Error response body: ${errorText}`);
      throw new Error(`SmartSCan API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    // Step 7: Parse response
    console.log(`\n📋 Step 7: Parsing response...`);
    const result: SmartScanResponse = await response.json();
    console.log(`✅ Response parsed successfully`);
    console.log(`🆔 Feedback ID: ${result.feedbackId}`);
    console.log(`📄 Raw response:`, JSON.stringify(result, null, 2));
    
    // Count extracted fields (exclude feedbackId and documentMetadata)
    const extractedFields = Object.keys(result).filter(key => key !== 'feedbackId' && key !== 'documentMetadata');
    console.log(`📊 Extracted fields count: ${extractedFields.length}`);
    console.log(`📝 Extracted fields: ${extractedFields.join(', ')}`);
    
    console.log(`\n=== SmartSCan Processing Completed Successfully ===`);
    console.log(`📄 Document: ${filename}`);
    console.log(`🆔 Feedback ID: ${result.feedbackId}`);
    console.log(`⏱️  Total duration: ${duration}ms`);
    console.log(`📊 Fields extracted: ${extractedFields.length}`);
    
    return result;
  }

  // Helper method to extract field values with confidence levels
  extractFieldData(answers: SmartScanAnswers, fieldName: string): {
    value: string | null;
    confidence: string | null;
    text: string | null;
    boundingBox: SmartScanBoundingBox | null;
  } {
    const fieldData = answers[fieldName as keyof SmartScanAnswers];
    
    if (!fieldData || fieldData.length === 0) {
      return {
        value: null,
        confidence: null,
        text: null,
        boundingBox: null
      };
    }

    // Get the first (and usually only) value
    const firstValue = fieldData[0];
    
    return {
      value: firstValue.value,
      confidence: firstValue.confidence.level,
      text: firstValue.text || null,
      boundingBox: firstValue.boundingBox || null
    };
  }

  // Helper method to get all extracted fields summary
  getExtractionSummary(answers: SmartScanAnswers): {
    totalFields: number;
    highConfidenceFields: number;
    extractedFields: string[];
    missingFields: string[];
  } {
    const allPossibleFields = [
      'orderDate', 'paymentDueDate', 'currency', 'totalVat', 'totalInclVat', 
      'totalExclVat', 'supplierCorporateId', 'supplierCountryCode', 'documentType',
      'paymentMethod', 'invoiceNumber', 'documentNumber', 'documentDate'
    ];

    const extractedFields: string[] = [];
    const missingFields: string[] = [];
    let highConfidenceFields = 0;

    allPossibleFields.forEach(field => {
      const fieldData = answers[field as keyof SmartScanAnswers];
      if (fieldData && fieldData.length > 0) {
        extractedFields.push(field);
        if (fieldData[0].confidence.level === 'VERY_HIGH' || fieldData[0].confidence.level === 'HIGH') {
          highConfidenceFields++;
        }
      } else {
        missingFields.push(field);
      }
    });

    return {
      totalFields: allPossibleFields.length,
      highConfidenceFields,
      extractedFields,
      missingFields
    };
  }
}
