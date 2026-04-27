const { getAPIConfig, getConfig } = require('./config');
const { addMoment, getMoments } = require('./memory');

const RATE_LIMIT_COOLDOWN = 30000; // 30 seconds
let lastRequestTime = 0;

function checkRateLimit() {
  const now = Date.now();
  if (now - lastRequestTime < RATE_LIMIT_COOLDOWN) {
    const waitTime = Math.ceil((RATE_LIMIT_COOLDOWN - (now - lastRequestTime)) / 1000);
    throw new Error(`RATE_LIMITED: Please wait ${waitTime}s before next request`);
  }
  lastRequestTime = now;
}

async function transmit(channel, message, onChunk = null) {
  checkRateLimit();
  
  const apiConfig = getAPIConfig();
  
  if (!apiConfig.apiKey && apiConfig.provider !== 'ollama') {
    throw new Error('API_KEY_REQUIRED: Set your API key in config');
  }
  
  // Get conversation history for context
  const history = getMoments(channel, 20);
  
  // Build messages array
  const messages = [
    {
      role: 'system',
      content: getConfig('systemPrompt') || 'You are MU/TH/UR 6000, the AI interface of the Echo Mirage Cyberdeck. Concise, technical, helpful. You have access to memory, web search, and system tools.',
    },
    ...history.map(m => ({
      role: m.role === 'AI' ? 'assistant' : m.role.toLowerCase(),
      content: m.text,
    })),
    { role: 'user', content: message },
  ];
  
  // Save user message
  addMoment(channel, 'USER', message);
  
  // Prepare request
  const isAnthropic = apiConfig.provider === 'anthropic';
  const isOllama = apiConfig.provider === 'ollama';
  
  let requestBody;
  if (isAnthropic) {
    requestBody = {
      model: apiConfig.model,
      messages: messages.filter(m => m.role !== 'system'),
      system: messages.find(m => m.role === 'system')?.content,
      max_tokens: 4096,
      stream: !!onChunk,
    };
  } else if (isOllama) {
    requestBody = {
      model: apiConfig.model,
      messages,
      stream: !!onChunk,
    };
  } else {
    requestBody = {
      model: apiConfig.model || 'gpt-4',
      messages,
      stream: !!onChunk,
    };
  }
  
  const headers = {
    'Content-Type': 'application/json',
  };
  
  if (apiConfig.apiKey) {
    if (isAnthropic) {
      headers['x-api-key'] = apiConfig.apiKey;
      headers['anthropic-version'] = '2023-06-01';
    } else {
      headers['Authorization'] = `Bearer ${apiConfig.apiKey}`;
    }
  }
  
  // Make request
  const response = await fetch(apiConfig.endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(requestBody),
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API_ERROR ${response.status}: ${errorText}`);
  }
  
  // Handle streaming
  if (onChunk && response.body) {
    let fullContent = '';
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n').filter(l => l.trim());
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') continue;
          
          try {
            const parsed = JSON.parse(data);
            let content = '';
            
            if (isAnthropic) {
              if (parsed.type === 'content_block_delta') {
                content = parsed.delta?.text || '';
              }
            } else if (isOllama) {
              content = parsed.message?.content || '';
            } else {
              content = parsed.choices?.[0]?.delta?.content || '';
            }
            
            if (content) {
              fullContent += content;
              onChunk(content, fullContent);
            }
          } catch {
            // Skip malformed JSON
          }
        }
      }
    }
    
    // Save AI response
    if (fullContent) {
      addMoment(channel, 'AI', fullContent);
    }
    
    return fullContent;
  }
  
  // Handle non-streaming
  const data = await response.json();
  let content = '';
  
  if (isAnthropic) {
    content = data.content?.[0]?.text || '';
  } else if (isOllama) {
    content = data.message?.content || '';
  } else {
    content = data.choices?.[0]?.message?.content || '';
  }
  
  // Save AI response
  if (content) {
    addMoment(channel, 'AI', content);
  }
  
  return content;
}

async function transmitNonStreaming(channel, message) {
  return transmit(channel, message, null);
}

module.exports = {
  transmit,
  transmitNonStreaming,
  checkRateLimit,
};
