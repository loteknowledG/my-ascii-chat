const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  chatStream: (opts) => ipcRenderer.invoke('chat-stream', opts),
  onStreamChunk: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on('stream-chunk', handler);
    return () => ipcRenderer.removeListener('stream-chunk', handler);
  },
  apiRequest: (opts) => ipcRenderer.invoke('api-request', opts),
});
