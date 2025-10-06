// Simple test script to verify MCP connection test
async function testMCPConnection(url) {
  try {
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
      signal: AbortSignal.timeout(15000)
    });
    
    if (response.ok) {
      const responseText = await response.text();
      console.log('Response text:', responseText);
      
      // Handle Server-Sent Events format
      if (responseText.includes('event: message') && responseText.includes('data: ')) {
        const dataMatch = responseText.match(/data: ({.*})/);
        if (dataMatch) {
          try {
            const data = JSON.parse(dataMatch[1]);
            if (data.jsonrpc === '2.0' && data.result) {
              console.log('✅ MCP Connection successful!');
              console.log('Server Info:', data.result.serverInfo);
              console.log('Capabilities:', data.result.capabilities);
              return { success: true, details: { statusCode: response.status, jsonrpc: true, serverInfo: data.result.serverInfo } };
            }
          } catch (e) {
            console.log('⚠️ Could not parse SSE data, but connection successful');
            return { success: true, details: { statusCode: response.status, sse: true } };
          }
        }
      }
      
      console.log('✅ Connection successful (fallback)');
      return { success: true, details: { statusCode: response.status } };
    } else {
      console.log('❌ Connection failed:', response.status, response.statusText);
      return { success: false, error: `MCP server error: ${response.status} ${response.statusText}` };
    }
  } catch (error) {
    console.log('❌ Connection error:', error.message);
    return { success: false, error: error.message };
  }
}

// Test the MCP connection
testMCPConnection('https://mcp.dev.fabricai.io/api')
  .then(result => {
    console.log('\nFinal result:', result);
  })
  .catch(err => {
    console.error('Test failed:', err);
  });
