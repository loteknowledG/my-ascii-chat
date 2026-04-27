const { app, BrowserWindow, ipcMain, net } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    backgroundColor: '#111',
    title: 'Weyland-Yutani Cyberdeck',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  const isDev = process.env.NODE_ENV === 'development' || !process.env.NODE_ENV;
  
  if (isDev) {
    win.loadURL('http://localhost:3000');
  } else {
    win.loadFile(path.join(__dirname, 'dist/index.html'));
  }

  win.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('[MAIN] Failed to load:', errorCode, errorDescription);
  });
}

// Streaming chat handler
ipcMain.handle('chat-stream', async (event, { endpoint, apiKey, model, messages }) => {
  return new Promise((resolve, reject) => {
    const request = net.request({
      method: 'POST',
      url: endpoint,
    });

    request.setHeader('Content-Type', 'application/json');
    if (apiKey) {
      request.setHeader('Authorization', `Bearer ${apiKey}`);
    }

    const body = JSON.stringify({
      model,
      messages,
      stream: true,
    });

    let fullContent = '';
    let buffer = '';

    request.on('response', (response) => {
      response.on('data', (chunk) => {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data:')) continue;
          
          const data = trimmed.slice(5).trim();
          if (data === '[DONE]') continue;

          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content || '';
            if (content) {
              fullContent += content;
              event.sender.send('stream-chunk', { chunk: content, full: fullContent });
            }
          } catch {
            // Skip malformed JSON
          }
        }
      });

      response.on('end', () => {
        resolve({ success: true, content: fullContent });
      });

      response.on('error', (err) => {
        reject(err);
      });
    });

    request.on('error', (err) => {
      reject(err);
    });

    request.write(body);
    request.end();
  });
});

// API request handler (non-streaming)
ipcMain.handle('api-request', async (event, { url, method, headers, body }) => {
  return new Promise((resolve, reject) => {
    const request = net.request({ method: method || 'GET', url });
    Object.entries(headers || {}).forEach(([k, v]) => request.setHeader(k, v));
    let responseData = '';
    request.on('response', (response) => {
      response.on('data', (chunk) => { responseData += chunk.toString(); });
      response.on('end', () => {
        resolve({ status: response.statusCode, headers: response.headers, body: responseData });
      });
      response.on('error', (err) => reject(err));
    });
    request.on('error', (err) => reject(err));
    if (body) request.write(body);
    request.end();
  });
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
