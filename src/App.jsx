import { useState, useEffect, useRef } from 'react'
import { setupAudio, playSystemSound } from './AudioEngine';


// --- PROXY CONFIGURATION ---
// This routes your requests through your Render server to bypass CORS blocks.
const PROXY = "https://cors-anywhere-dqgj.onrender.com/";

const art = {
  popped: (id) => ` ┌───┐\n │ ${id.toUpperCase()} │▒\n └───┘▒\n  ▒▒▒▒▒`,
  pushed: (id) => `\n ┌───┐\n │ ${id.toUpperCase()} │\n └───┘`
};

export default function App() {
  const [booted, setBooted] = useState(false);
  const [server, setServer] = useState('m');
  const [chan, setChan] = useState('general');
  const [input, setInput] = useState('');
  const [channelData, setChannelData] = useState({ general: [], intel: [], logs: [] });
  const [modelList, setModelList] = useState([]);
  
  // OPENCODE ADDED TO PROVIDERS
  const providers = ['opencode', 'openrouter', 'openai']; 
  const [activeProvider, setActiveProvider] = useState(localStorage.getItem('active_provider') || 'opencode');
  
  const [keys, setKeys] = useState({
    opencode: localStorage.getItem('key_opencode') || '',
    openrouter: localStorage.getItem('key_openrouter') || '',
    openai: localStorage.getItem('key_openai') || ''
  });

  const [modelID, setModelID] = useState(localStorage.getItem('ascii_model') || 'trinity-mini:free');

  const chatEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => { if (booted && inputRef.current) inputRef.current.focus(); }, [booted, chan, server]);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [channelData, chan]);

  // --- FETCH MODELS LOGIC ---
  useEffect(() => {
    const fetchModels = async () => {
      const currentKey = keys[activeProvider];
      if (!booted || !currentKey) return;
      try {
        let target = ''; 
        if (activeProvider === 'openai') {
          target = 'https://api.openai.com/v1/models';
        } else if (activeProvider === 'opencode') {
          target = 'https://opencode.ai/zen/v1/models'; // FIXED ENDPOINT
        } else {
          target = 'https://openrouter.ai/api/v1/models';
        }
        
        const res = await fetch(PROXY + target, { 
            headers: { 
                'Authorization': `Bearer ${currentKey}`,
                'X-Requested-With': 'XMLHttpRequest' // SECURITY HANDSHAKE
            } 
        });

        if (!res.ok) throw new Error(`HTTP_${res.status}`);

        const data = await res.json();
        if (data.data) {
          const sorted = data.data.sort((a, b) => {
            const aFree = a.id.toLowerCase().includes('free');
            const bFree = b.id.toLowerCase().includes('free');
            return aFree === bFree ? 0 : aFree ? -1 : 1;
          });
          setModelList(sorted.slice(0, 50));
        }
      } catch (e) { 
        console.error("FETCH_ERR", e); 
      }
    };
    fetchModels();
  }, [activeProvider, booted, keys]);

  // --- SEND MESSAGE LOGIC ---
  const handleSend = async (e) => {
    if (e.key !== 'Enter' || !input.trim()) return;
    playSystemSound('click', 0.15);
    const val = input.trim();
    setInput('');

    if (chan === 'providers') {
      const newKeys = { ...keys, [activeProvider]: val };
      setKeys(newKeys);
      localStorage.setItem(`key_${activeProvider}`, val);
      playSystemSound('chirp');
      setChannelData(p => ({ ...p, logs: [...p.logs, { role: 'SYS', text: `KEY FOR ${activeProvider.toUpperCase()} REGISTERED.` }] }));
      return;
    }

    setChannelData(prev => ({ ...prev, [chan]: [...prev[chan], { role: 'USER', text: val }] }));
    const currentKey = keys[activeProvider];
    
    if (!currentKey) {
        return setChannelData(prev => ({ ...prev, [chan]: [...prev[chan], { role: 'SYS', text: "ERROR: KEY MISSING" }] }));
    }

    const aiId = Date.now();
    setChannelData(prev => ({ ...prev, [chan]: [...prev[chan], { role: 'AI', text: '', id: aiId }] }));

    let systemPrompt = "You are MU/TH/UR 6000. Concise, technical.";
    if (chan === 'intel') systemPrompt = "Science Officer interface. objective data analysis.";
    if (chan === 'logs') systemPrompt = "Mission Recorder. Chronological log format.";
    
    try {
      let endpoint = '';
      if (activeProvider === 'openai') {
        endpoint = 'https://api.openai.com/v1/chat/completions';
      } else if (activeProvider === 'opencode') {
        endpoint = 'https://opencode.ai/zen/v1/chat/completions'; // FIXED ENDPOINT
      } else {
        endpoint = 'https://openrouter.ai/api/v1/chat/completions';
      }

      const response = await fetch(PROXY + endpoint, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json', 
          'Authorization': `Bearer ${currentKey}`,
          'X-Requested-With': 'XMLHttpRequest', // SECURITY HANDSHAKE
          'HTTP-Referer': window.location.href,
        },
        body: JSON.stringify({ 
          model: modelID, 
          messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: val }], 
          stream: true 
        })
      });

      if (!response.ok) throw new Error(`HTTP_${response.status}`);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullContent = ""; let streamBuffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        streamBuffer += decoder.decode(value, { stream: true });
        const lines = streamBuffer.split('\n');
        streamBuffer = lines.pop();
        for (const line of lines) {
          const cleaned = line.replace(/^data: /, "").trim();
          if (!cleaned || cleaned === "[DONE]") continue;
          try {
            const parsed = JSON.parse(cleaned);
            const content = parsed.choices[0]?.delta?.content || "";
            if (content) {
              fullContent += content;
              playSystemSound('click', 0.05); 
              setChannelData(prev => ({
                ...prev, [chan]: prev[chan].map(m => m.id === aiId ? { ...m, text: fullContent } : m)
              }));
            }
          } catch (e) {}
        }
      }
    } catch (err) {
      setChannelData(prev => ({ ...prev, [chan]: [...prev[chan], { role: 'SYS', text: `UPLINK ERR: ${err.message}` }] }));
    }
  };

  if (!booted) {
    return (
      <div onClick={() => { setupAudio(); setBooted(true); }} style={{ height: '100vh', backgroundColor: '#000', color: '#00ff00', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontFamily: 'monospace' }}>
        <pre>{`[ WEYLAND-YUTANI CORP ]\n[ MU/TH/UR 6000 ]\n\n>> INITIALIZE UPLINK <<`}</pre>
      </div>
    );
  }

  return (
    <div onClick={() => { if (audioCtx?.state === 'suspended') audioCtx.resume(); }} style={{ backgroundColor: '#000', color: '#00ff00', height: '100vh', display: 'flex', fontFamily: 'monospace', overflow: 'hidden', fontSize: '14px' }}>
      
      {/* COL 1: SERVERS */}
      <div style={{ width: '80px', borderRight: '1px solid #1a1a1a', padding: '10px' }}>
        {['m', 's'].map(id => (
          <div key={id} onClick={() => { setServer(id); setChan(id === 'm' ? 'general' : 'providers'); playSystemSound('chirp'); }} style={{ marginBottom: '20px', cursor: 'pointer' }}>
            <pre style={{ margin: 0, color: server === id ? '#00ff00' : '#222' }}>{server === id ? art.pushed(id) : art.popped(id)}</pre>
          </div>
        ))}
      </div>

      {/* COL 2: NAV */}
      <div style={{ width: '240px', borderRight: '1px solid #1a1a1a', padding: '20px 10px', overflowY: 'auto' }}>
        <div style={{ color: '#444', fontSize: '10px', marginBottom: '10px' }}>{server === 'm' ? 'MAIN_NET' : 'SYSTEM_RESOURCES'}</div>
        {server === 'm' ? (
          ['general', 'intel', 'logs'].map(c => (
            <div key={c} onClick={() => { setChan(c); playSystemSound('click'); }} style={{ cursor: 'pointer', color: chan === c ? '#00ff00' : '#333', padding: '8px 0' }}>{chan === c ? '> ' : '# '}{c.toUpperCase()}</div>
          ))
        ) : (
          <>
            <div onClick={() => { setChan('providers'); playSystemSound('click'); }} style={{ cursor: 'pointer', color: chan === 'providers' ? '#00ff00' : '#333', padding: '8px 0' }}># GATEWAY_KEYS</div>
            {providers.map(p => (
              <div key={p} onClick={() => { setActiveProvider(p); localStorage.setItem('active_provider', p); playSystemSound('chirp'); }} style={{ cursor: 'pointer', color: activeProvider === p ? '#00ff00' : '#222', padding: '5px 0' }}>{activeProvider === p ? '[X] ' : '[ ] '}{p.toUpperCase()}</div>
            ))}
            <div style={{ marginTop: '20px', borderTop: '1px solid #111', paddingTop: '10px' }}>
              <div style={{ fontSize: '10px', color: '#444', marginBottom: '10px' }}>AVAILABLE_MODELS:</div>
              {modelList.map(m => (
                <div key={m.id} onClick={() => { setModelID(m.id); localStorage.setItem('ascii_model', m.id); playSystemSound('click'); }} 
                     style={{ cursor: 'pointer', color: modelID === m.id ? '#00ff00' : (m.id.includes('free') ? '#ffaa00' : '#222'), fontSize: '10px', padding: '4px 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {m.id.split('/').pop()}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* COL 3: TERMINAL */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '20px' }}>
        <div style={{ flex: 1, overflowY: 'auto', paddingBottom: '20px' }}>
          <div style={{ color: '#111', fontSize: '10px', marginBottom: '20px' }}>STATION: {activeProvider.toUpperCase()} // {chan.toUpperCase()} // {modelID}</div>
          
          {chan === 'providers' && (
            <div style={{ marginBottom: '20px', color: '#444' }}>
               <div style={{ color: '#00ff00', marginBottom: '10px' }}>[ SYSTEM GATEWAY: {activeProvider.toUpperCase()} ]</div>
               <div>STATUS: {keys[activeProvider] ? "KEY_READY" : "WAITING_FOR_UPLINK..."}</div>
               {keys[activeProvider] && <div style={{ color: '#555', fontSize: '10px' }}>UPLINK_ID: ****{keys[activeProvider].slice(-4)}</div>}
            </div>
          )}

          {(channelData[chan] || []).map((m, i) => (
            <div key={i} style={{ marginBottom: '15px' }}><span style={{ color: m.role === 'AI' ? '#00ff00' : (m.role === 'SYS' ? '#ffaa00' : '#444') }}>[{m.role}]</span> {m.text}</div>
          ))}
          <div ref={chatEndRef} />
        </div>
        <div style={{ display: 'flex', borderTop: '1px solid #1a1a1a', paddingTop: '15px' }}>
          <span style={{ marginRight: '10px' }}>{'>'}</span>
          <input 
            ref={inputRef} value={input} 
            onChange={(e) => { setInput(e.target.value); playSystemSound('click', 0.04); }} 
            onKeyDown={handleSend} placeholder={chan === 'providers' ? "ENTER GATEWAY KEY..." : "MESSAGE MU/TH/UR..."} 
            style={{ background: 'none', border: 'none', color: '#00ff00', outline: 'none', flex: 1, fontFamily: 'monospace' }} 
          />
        </div>
      </div>
    </div>
  );
}