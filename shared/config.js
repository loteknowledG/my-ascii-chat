const path = require('path');
const fs = require('fs');
const os = require('os');

const CONFIG_DIR = path.join(os.homedir(), '.echo-mirage');
const CONFIG_PATH = path.join(CONFIG_DIR, 'config.json');

if (!fs.existsSync(CONFIG_DIR)) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
}

const defaultConfig = {
  // AI Provider settings
  provider: 'opencode', // opencode, openai, anthropic, ollama
  apiKey: '',
  apiEndpoint: '',
  model: '',
  
  // Ollama settings (for local models)
  ollama: {
    host: 'http://localhost:11434',
    model: 'llama3',
  },
  
  // UI settings
  theme: 'cyberpunk',
  fontSize: 12,
  showTimestamps: true,
  
  // Audio settings
  tts: {
    enabled: true,
    voice: 'default',
    rate: 1.0,
    pitch: 1.0,
    volume: 0.8,
  },
  
  // Memory settings
  memory: {
    autoSave: true,
    maxMomentsPerChannel: 1000,
    memoryRetentionDays: 30,
  },
  
  // Hardware settings (for cyberdeck)
  hardware: {
    gpioEnabled: false,
    displayBrightness: 100,
    keyboardLayout: 'qwerty',
  },
};

function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const data = fs.readFileSync(CONFIG_PATH, 'utf8');
      const parsed = JSON.parse(data);
      return { ...defaultConfig, ...parsed };
    }
  } catch (err) {
    console.error('Failed to load config:', err.message);
  }
  return { ...defaultConfig };
}

function saveConfig(config) {
  try {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('Failed to save config:', err.message);
    return false;
  }
}

function getConfig(key) {
  const config = loadConfig();
  if (!key) return config;
  
  const keys = key.split('.');
  let value = config;
  for (const k of keys) {
    if (value && typeof value === 'object' && k in value) {
      value = value[k];
    } else {
      return undefined;
    }
  }
  return value;
}

function setConfig(key, value) {
  const config = loadConfig();
  const keys = key.split('.');
  let target = config;
  
  for (let i = 0; i < keys.length - 1; i++) {
    if (!(keys[i] in target) || typeof target[keys[i]] !== 'object') {
      target[keys[i]] = {};
    }
    target = target[keys[i]];
  }
  
  target[keys[keys.length - 1]] = value;
  return saveConfig(config);
}

function resetConfig() {
  return saveConfig(defaultConfig);
}

function getAPIConfig() {
  const config = loadConfig();
  
  switch (config.provider) {
    case 'opencode':
      return {
        endpoint: config.apiEndpoint || 'https://opencode.ai/zen/v1/chat/completions',
        apiKey: config.apiKey,
        model: config.model,
      };
    case 'openai':
      return {
        endpoint: 'https://api.openai.com/v1/chat/completions',
        apiKey: config.apiKey,
        model: config.model || 'gpt-4',
      };
    case 'anthropic':
      return {
        endpoint: 'https://api.anthropic.com/v1/messages',
        apiKey: config.apiKey,
        model: config.model || 'claude-3-opus-20240229',
      };
    case 'ollama':
      return {
        endpoint: `${config.ollama.host}/api/chat`,
        apiKey: '',
        model: config.ollama.model,
      };
    default:
      return {
        endpoint: config.apiEndpoint,
        apiKey: config.apiKey,
        model: config.model,
      };
  }
}

module.exports = {
  loadConfig,
  saveConfig,
  getConfig,
  setConfig,
  resetConfig,
  getAPIConfig,
  CONFIG_PATH,
  CONFIG_DIR,
};
