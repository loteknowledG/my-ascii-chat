const path = require('path');
const fs = require('fs');
const os = require('os');

const DB_DIR = path.join(os.homedir(), '.echo-mirage');
const DB_PATH = path.join(DB_DIR, 'mother.json');

if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

let data = { moments: [], memories: [], context: {}, channels: [] };

function loadData() {
  try {
    if (fs.existsSync(DB_PATH)) {
      const raw = fs.readFileSync(DB_PATH, 'utf8');
      data = JSON.parse(raw);
    }
  } catch (err) {
    console.error('Failed to load database:', err.message);
    data = { moments: [], memories: [], context: {}, channels: [] };
  }
  
  // Ensure structure
  if (!data.moments) data.moments = [];
  if (!data.memories) data.memories = [];
  if (!data.context) data.context = {};
  if (!data.channels) data.channels = [];
  
  // Insert default channels if empty
  if (data.channels.length === 0) {
    data.channels = [
      { id: 'agenda', name: 'AGENDA', description: 'Mission planning and objectives' },
      { id: 'intel', name: 'INTEL', description: 'Science Officer interface' },
      { id: 'logs', name: 'LOGS', description: 'Mission Recorder' },
      { id: 'samus-manus', name: 'SAMUS-MANUS', description: 'Voice and utilities' },
    ];
  }
  
  return data;
}

function saveData() {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to save database:', err.message);
  }
}

function addMoment(channel, role, text, metadata = {}) {
  loadData();
  const moment = {
    id: `m_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    timestamp: Date.now(),
    channel,
    role,
    text,
    metadata,
  };
  data.moments.push(moment);
  saveData();
  return moment;
}

function getMoments(channel, limit = 50, before = null) {
  loadData();
  let moments = data.moments.filter(m => m.channel === channel);
  
  if (before) {
    moments = moments.filter(m => m.timestamp < before);
  }
  
  moments.sort((a, b) => a.timestamp - b.timestamp);
  return moments.slice(-limit);
}

function addMemory(category, content, importance = 0.5, metadata = {}) {
  loadData();
  const memory = {
    id: `mem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    timestamp: Date.now(),
    category,
    content,
    importance,
    accessed_count: 0,
    last_accessed: Date.now(),
    metadata,
  };
  data.memories.push(memory);
  saveData();
  return memory;
}

function searchMemories(query, category = null, limit = 10) {
  loadData();
  let memories = data.memories.filter(m => 
    m.content.toLowerCase().includes(query.toLowerCase())
  );
  
  if (category) {
    memories = memories.filter(m => m.category === category);
  }
  
  memories.sort((a, b) => b.importance - a.importance);
  
  // Update access count
  const accessed = memories.slice(0, limit);
  for (const mem of accessed) {
    mem.accessed_count = (mem.accessed_count || 0) + 1;
    mem.last_accessed = Date.now();
  }
  saveData();
  
  return accessed;
}

function getRecentMemories(limit = 20) {
  loadData();
  const memories = [...data.memories];
  memories.sort((a, b) => (b.last_accessed || b.timestamp) - (a.last_accessed || a.timestamp));
  return memories.slice(0, limit);
}

function setContext(key, value) {
  loadData();
  data.context[key] = {
    value,
    updated_at: Date.now(),
  };
  saveData();
}

function getContext(key) {
  loadData();
  return data.context[key]?.value || null;
}

function getAllContext() {
  loadData();
  const result = {};
  for (const [key, obj] of Object.entries(data.context)) {
    result[key] = obj.value;
  }
  return result;
}

function getChannels() {
  loadData();
  return data.channels;
}

function exportMemory() {
  loadData();
  return {
    ...data,
    exported_at: Date.now(),
  };
}

function importMemory(importedData) {
  loadData();
  if (importedData.moments) {
    data.moments = [...data.moments, ...importedData.moments];
  }
  if (importedData.memories) {
    data.memories = [...data.memories, ...importedData.memories];
  }
  if (importedData.context) {
    data.context = { ...data.context, ...importedData.context };
  }
  saveData();
}

function clearMoments(channel = null) {
  loadData();
  if (channel) {
    const before = data.moments.length;
    data.moments = data.moments.filter(m => m.channel !== channel);
    saveData();
    return before - data.moments.length;
  } else {
    const count = data.moments.length;
    data.moments = [];
    saveData();
    return count;
  }
}

function clearMemories() {
  loadData();
  const count = data.memories.length;
  data.memories = [];
  saveData();
  return count;
}

function getStats() {
  loadData();
  return {
    moments: data.moments.length,
    memories: data.memories.length,
    channels: data.channels.length,
    context_keys: Object.keys(data.context).length,
  };
}

module.exports = {
  addMoment,
  getMoments,
  addMemory,
  searchMemories,
  getRecentMemories,
  setContext,
  getContext,
  getAllContext,
  getChannels,
  exportMemory,
  importMemory,
  clearMoments,
  clearMemories,
  getStats,
  DB_PATH,
};
