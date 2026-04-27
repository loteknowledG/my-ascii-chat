import React, { useState } from 'react';

const ENDPOINTS = {
  opencode: 'https://opencode.ai/zen/v1/chat/completions',
  openai: 'https://api.openai.com/v1/chat/completions',
  openrouter: 'https://openrouter.ai/api/v1/chat/completions'
};
const MODEL_LISTS = {
  opencode: 'https://opencode.ai/zen/v1/models',
  openai: 'https://api.openai.com/v1/models',
  openrouter: 'https://openrouter.ai/api/v1/models'
};

const PROXY = "https://corsproxy.io/";

let chatRateLimited = false;
let lastChatFail = 0;
const isElectron = typeof window !== 'undefined' && window.electron && window.electron.invoke;

const doRequest = async (url, method, headers, body) => {
  if (isElectron) {
    return window.electron.invoke('api-request', { url, method, headers, body });
  }
  const proxyUrl = `${PROXY}?url=${encodeURIComponent(url)}`;
  const opts = { method: body ? 'POST' : 'GET', headers };
  if (body) opts.body = body;
  try {
    const res = await fetch(proxyUrl, opts);
    const text = await res.text();
    if (res.status === 429) {
      chatRateLimited = true;
      lastChatFail = Date.now();
    }
    return { status: res.status, headers: {}, body: text };
  } catch (e) {
    return { status: 0, headers: {}, body: '', error: String(e) };
  }
};

export const isChatRateLimited = () => chatRateLimited && (Date.now() - lastChatFail < 30000);
export const resetChatRateLimit = () => { chatRateLimited = false; };

export const transmit = async (provider, type, key, payload = null) => {
  const url = type === 'models' ? MODEL_LISTS[provider] : ENDPOINTS[provider];
  const headers = {
    'Authorization': `Bearer ${key}`,
    'Content-Type': 'application/json',
  };
  const body = payload ? JSON.stringify(payload) : null;
  const result = await doRequest(url, payload ? 'POST' : 'GET', headers, body);
  
  return {
    ok: result.status >= 200 && result.status < 300,
    status: result.status,
    json: () => Promise.resolve(JSON.parse(result.body || '{}')),
    text: () => Promise.resolve(result.body || ''),
    body: {
      getReader: () => {
        const text = result.body || '';
        const lines = text.split('\n');
        let idx = 0;
        return {
          read: () => {
            return idx >= lines.length
              ? { done: true, value: undefined }
              : { done: false, value: new TextEncoder().encode(lines[idx++]) };
          }
        };
      }
    }
  };
};

export const Uplink = ({ status, providerName }) => {
  const getStyle = () => {
    if (status === 'SCANNING') return 'scanning-wave';
    if (status === 'CONNECTED') return 'locked-green';
    if (status === 'ERROR') return 'critical-red';
    return 'idle-grey';
  };

  return (
    <div className={`uplink-container ${getStyle()}`}>
      <span className="status-symbol">
        {status === 'CONNECTED' ? '●' : '○'}
      </span>
      <span className="status-text">
        {status === 'SCANNING' ? 'PROBING_UPLINK...' : `UPLINK: ${providerName}`}
      </span>
      <div className="uplink-meta">
        <span className="signal-strength">
          SIG_STR: {status === 'CONNECTED' ? '98.4%' : '00.0%'}
        </span>
        <span className="interference">
          VOLATILITY: {status === 'SCANNING' ? 'HIGH' : 'LOW'}
        </span>
      </div>
    </div>
  );
};

export const validateConnection = async (provider, key, setUplinkStatus, setChannel, AudioEngine) => {
  if (!key) {
    setUplinkStatus('IDLE');
    return;
  }

  setUplinkStatus('SCANNING');

  try {
    const result = await doRequest(MODEL_LISTS[provider], 'GET', { 'Authorization': `Bearer ${key}` }, null);
    if (result.status === 200) {
      AudioEngine.playLock();
      setUplinkStatus('CONNECTED');
      setTimeout(() => setChannel('agenda'), 1200);
    } else {
      setUplinkStatus('ERROR');
    }
  } catch (err) {
    console.error("UPLINK_FAILURE:", err);
    setUplinkStatus('ERROR');
  }
};