import { useState, useEffect, useRef } from 'react'

const db = {
  m: { 
    name: "MAIN NET", 
    chans: { "general": "Encrypted uplink active.", "intel": "Scanning..." }
  },
  s: { 
    name: "SYSTEM", 
    chans: { "providers": "" } 
  }
};

const art = {
  popped: (c) => ` ┌───┐\n │ ${c.toUpperCase()} │▒\n └───┘▒\n  ▒▒▒▒▒`,
  pushed: (c) => `\n ┌───┐\n │ ${c.toUpperCase()} │\n └───┘`
};

export default function App() {
  const [server, setServer] = useState('m');
  const [chan, setChan] = useState('general');
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [modelList, setModelList] = useState([]);
  
  const [activeProvider, setActiveProvider] = useState(localStorage.getItem('active_provider') || null);
  const [keys, setKeys] = useState({
    openrouter: localStorage.getItem('key_openrouter') || '',
    openai: localStorage.getItem('key_openai') || ''
  });
  const [modelID, setModelID] = useState(localStorage.getItem('ascii_model') || 'google/gemini-2.0-flash-exp:free');
  
  const chatEndRef = useRef(null);
  const inputRef = useRef(null);

  // --- FOCUS LOCK ---
  useEffect(() => {
    const keepFocus = () => {
      setTimeout(() => {
        if (inputRef.current) inputRef.current.focus();
      }, 0);
    };
    keepFocus();
    window.addEventListener('click', keepFocus);
    return () => window.removeEventListener('click', keepFocus);
  }, []);

  // --- AUTO-SCROLL ---
  useEffect(() => { 
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); 
  }, [messages]);

  // --- FETCH MODELS ---
  useEffect(() => {
    if (!activeProvider || !keys[activeProvider]) return;
    const fetchModels = async () => {
      try {
        let url = activeProvider === 'openrouter' ? 'https://openrouter.ai/api/v1/models' : 'https://api.openai.com/v1/models';
        let headers = { 'Authorization': `Bearer ${keys[activeProvider]}` };
        const res = await fetch(url, { headers });
        const data = await res.json();
        if (data.data) {
          const sorted = data.data.sort((a, b) => {
            const aFree = a.id.includes(':free') || a.id.includes('mini');
            const bFree = b.id.includes(':free') || b.id.includes('mini');
            return aFree === bFree ? 0 : aFree ? -1 : 1;
          });
          setModelList(sorted);
        }
      } catch (e) { console.error("UPLINK ERROR", e); }
    };
    fetchModels();
  }, [activeProvider, keys]);

  const getActiveModelName = () => {
    const found = modelList.find(m => m.id === modelID);
    return found ? (found.name || found.id) : modelID;
  };

  const isLoggedIn = activeProvider && keys[activeProvider]?.length > 0;

  const handleSend = async (e) => {
    if (e.key !== 'Enter' || !input.trim()) return;
    const currentInput = input;
    setInput('');

    // --- PROVIDER SETUP ---
    if (chan === 'providers') {
      if (!activeProvider) return;
      setKeys(prev => ({ ...prev, [activeProvider]: currentInput.trim() }));
      localStorage.setItem(`key_${activeProvider}`, currentInput.trim());
      setMessages(prev => [...prev, { role: 'SYS', text: `${activeProvider.toUpperCase()} KEY SAVED.` }]);
      return;
    }

    // --- CHAT LOGIC ---
    setMessages(prev => [...prev, { role: 'USER', text: currentInput }]);
    const currentKey = keys[activeProvider];
    
    if (!currentKey) {
      setMessages(prev => [...prev, { role: 'SYS', text: `ERROR: NO ${activeProvider?.toUpperCase()} KEY.` }]);
      return;
    }

    const aiMessageId = Date.now();
    setMessages(prev => [...prev, { role: 'AI', text: '...', id: aiMessageId }]);
    
    try {
      const url = activeProvider === 'openrouter' 
        ? 'https://openrouter.ai/api/v1/chat/completions' 
        : 'https://api.openai.com/v1/chat/completions';

      // Map internal messages to AI-compatible format (Context History)
      const apiMessages = [
        ...messages.filter(m => m.role !== 'SYS').map(m => ({
          role: m.role === 'USER' ? 'user' : 'assistant',
          content: m.text
        })),
        { role: 'user', content: currentInput }
      ];

      const response = await fetch(url, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json', 
          'Authorization': `Bearer ${currentKey}` 
        },
        body: JSON.stringify({ 
          model: modelID, 
          messages: apiMessages,
          stream: true 
        })
      });

     const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        
        // Split by lines because one chunk can contain multiple "data:" blocks
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          const cleanedLine = line.replace(/^data: /, "").trim();
          
          if (!cleanedLine || cleanedLine === "[DONE]") continue;

          try {
            // Some providers wrap the JSON in extra brackets or quotes
            const parsed = JSON.parse(cleanedLine);
            const content = parsed.choices[0]?.delta?.content || "";
            
            if (content) {
              fullText += content;
              // We use a functional update (prev => ...) to ensure React 
              // doesn't miss any fast-moving characters
              setMessages(prev => prev.map(m => 
                m.id === aiMessageId ? { ...m, text: fullText } : m
              ));
            }
          } catch (e) {
            // This is likely a partial JSON fragment. 
            // In a terminal, we can just skip it or wait for the next chunk.
            continue; 
          }
        }
      }
    } catch (err) {
      setMessages(prev => [...prev, { role: 'SYS', text: `Uplink Failure: ${err.message}` }]);
    }
  };

  return (
    <div className="ui-wrapper" style={{ fontFamily: 'monospace' }}>
      {/* SERVER BAR */}
      <div className="sidebar-servers">
        {['m', 's'].map(id => (
          <div key={id} className="btn-container" onClick={() => { 
            setServer(id); 
            setChan(Object.keys(db[id].chans)[0]); 
          }}>
            <pre className={`ascii-btn ${server === id ? 'is-pushed' : ''}`}>{server === id ? art.pushed(id) : art.popped(id)}</pre>
          </div>
        ))}
      </div>

      {/* CHANNEL BAR */}
      <div className="sidebar-channels" style={{ textTransform: 'uppercase' }}>
        <h2 className="server-title" style={{ color: '#00ff00' }}>{db[server].name}</h2>
        {Object.keys(db[server].chans).map(c => (
          <div key={c} className={`channel-item ${chan === c ? 'active-chan' : ''}`} onClick={() => setChan(c)}># # # # {c}</div>
        ))}

        {server === 's' && (
          <div className="system-menu" style={{ marginTop: '20px', borderTop: '1px solid #333' }}>
            <div style={{ padding: '10px 5px', fontSize: '10px', color: '#444' }}>--- UPLINK GATEWAY ---</div>
            {['openrouter', 'openai'].map(p => (
              <div key={p} 
                className={`channel-item ${activeProvider === p ? 'active-chan' : ''}`} 
                onClick={() => {
                  setActiveProvider(p);
                  localStorage.setItem('active_provider', p);
                }}>
                # # # # {p}
              </div>
            ))}

            {activeProvider && (
              <div className="model-list-scroll" style={{ marginTop: '10px', maxHeight: '40vh', overflowY: 'auto', borderTop: '1px dashed #222' }}>
                <div style={{ padding: '5px', fontSize: '9px', color: '#444' }}>SELECT MODEL:</div>
                {modelList.map(m => {
                  const isFree = m.id.includes(':free') || m.id.includes('mini');
                  return (
                    <div key={m.id} className={`channel-item ${modelID === m.id ? 'active-chan' : ''}`} style={{ fontSize: '9px', paddingLeft: '10px' }} onClick={() => { setModelID(m.id); localStorage.setItem('ascii_model', m.id); }}>
                      # # # {m.id.replace(':free', '')} {isFree && <span style={{color: '#00ff00', marginLeft: '5px'}}>[FREE]</span>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* CHAT AREA */}
      <div className="chat-area">
        <div className="chat-header" style={{ textTransform: 'uppercase' }}>
          --- # {chan} 
          {isLoggedIn && (
            <span style={{ color: '#00ff00', textShadow: '0 0 5px #00ff00', marginLeft: '10px' }}>
              [ {activeProvider} | {getActiveModelName()} ]
            </span>
          )} ---
        </div>
        
        <div className="message-log">
          <div className="system-msg" style={{ fontStyle: 'italic', color: '#888', textTransform: 'uppercase' }}>
            {chan === 'providers' ? (activeProvider ? `ENTER ${activeProvider} KEY.` : "SELECT PROVIDER.") : db[server].chans[chan]}
          </div>
          {messages.map((m, i) => (
            <div key={i} className="msg">
              <span className="msg-prefix" style={{ color: m.role === 'AI' ? '#00ff00' : '#444', fontWeight: 'bold' }}>{m.role === 'SYS' ? '>>>' : m.role}: </span>
              <span className="msg-text">{m.text}</span>
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>

        <div className="input-row">
          <span className="prompt" style={{ color: '#00ff00' }}>{'>'}</span>
          <input 
            ref={inputRef}
            value={input} 
            onChange={(e) => setInput(e.target.value)} 
            onKeyDown={handleSend} 
            placeholder="Input command..." 
            autoFocus 
            style={{ color: '#00ff00', background: 'transparent', border: 'none', outline: 'none', width: '100%', fontFamily: 'monospace' }} 
          />
        </div>
      </div>
    </div>
  );
}