import { useState, useEffect, useRef } from 'react'

const db = {
  m: { name: "MAIN NET", chans: { "general": "WELCOME TO THE GRID.", "intel": "SCANNING FOR DATA..." }},
  s: { name: "SYSTEM", chans: { "config": "PASTE OPENROUTER KEY + ENTER.", "model": "SELECT OR TYPE MODEL ID." }}
};

export default function App() {
  const [server, setServer] = useState('m');
  const [chan, setChan] = useState('general');
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [modelList, setModelList] = useState([]);
  
  const [apiKey, setApiKey] = useState(localStorage.getItem('ascii_key') || '');
  const [modelID, setModelID] = useState(localStorage.getItem('ascii_model') || 'google/gemini-2.0-flash-exp:free');
  
  const chatEndRef = useRef(null);

  // 1. SCAN FOR FREE MODELS ON STARTUP
  useEffect(() => {
    fetch('https://openrouter.ai/api/v1/models')
      .then(res => res.json())
      .then(data => {
        const freeOnes = data.data.filter(m => m.id.includes(':free'));
        setModelList(freeOnes);
      }).catch(e => console.error("SCAN FAIL", e));
  }, []);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const art = {
    popped: (c) => ` ┌───┐\n │ ${c.toUpperCase()} │▒\n └───┘▒\n  ▒▒▒▒▒`,
    pushed: (c) => `\n ┌───┐\n │ ${c.toUpperCase()} │\n └───┘`
  };

  const handleSend = async (e) => {
    if (e.key !== 'Enter' || !input.trim()) return;
    const currentInput = input;
    setInput('');

    if (chan === 'config') {
      localStorage.setItem('ascii_key', currentInput.trim());
      setApiKey(currentInput.trim());
      setMessages(prev => [...prev, { role: 'SYS', text: 'KEY SAVED.' }]);
      return;
    }

    if (chan === 'model') {
      const newModel = currentInput.trim().toLowerCase();
      localStorage.setItem('ascii_model', newModel);
      setModelID(newModel);
      setMessages(prev => [...prev, { role: 'SYS', text: `TUNED TO: ${newModel}` }]);
      return;
    }

    setMessages(prev => [...prev, { role: 'USER', text: currentInput.toUpperCase() }]);
    if (!apiKey) {
      setMessages(prev => [...prev, { role: 'SYS', text: 'ERROR: NO KEY. GO TO SYSTEM > CONFIG.' }]);
      return;
    }

    setMessages(prev => [...prev, { role: 'AI', text: 'ESTABLISHING UPLINK...' }]);
    
    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': 'http://localhost:5173', 
          'X-Title': 'ASCII TERMINAL'
        },
        body: JSON.stringify({ model: modelID, messages: [{ role: 'user', content: currentInput }] })
      });

      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error.message || "PROVIDER ERROR");
      }

      const aiText = data.choices[0].message.content.toUpperCase();
      setMessages(prev => {
        const filtered = prev.filter(m => m.text !== 'ESTABLISHING UPLINK...');
        return [...filtered, { role: 'AI', text: aiText }];
      });

    } catch (err) {
      setMessages(prev => {
        const filtered = prev.filter(m => m.text !== 'ESTABLISHING UPLINK...');
        return [...filtered, { role: 'SYS', text: `UPLINK FAILURE: ${err.message}` }];
      });
    }
  };

  return (
    <div className="ui-wrapper">
      <div className="sidebar-servers">
        {['m', 's'].map(id => (
          <div key={id} className="btn-container" onClick={() => {setServer(id); setChan(Object.keys(db[id].chans)[0])}}>
            <pre className={`ascii-btn ${server === id ? 'is-pushed' : ''}`}>
              {server === id ? art.pushed(id) : art.popped(id)}
            </pre>
          </div>
        ))}
      </div>

      <div className="sidebar-channels">
        <h2 className="server-title">{db[server].name}</h2>
        {Object.keys(db[server].chans).map(c => (
          <div key={c} className={`channel-item ${chan === c ? 'active-chan' : ''}`} onClick={() => setChan(c)}>{c}</div>
        ))}

        {server === 's' && (
          <div className="model-list" style={{ marginTop: '20px', borderTop: '1px solid #333', overflowY: 'auto', maxHeight: '60vh' }}>
            <div style={{ padding: '10px 5px', fontSize: '10px', color: '#444' }}>FREE MODELS:</div>
            {modelList.map(m => (
              <div key={m.id} 
                   className={`channel-item ${modelID === m.id ? 'active-chan' : ''}`} 
                   style={{ fontSize: '9px' }}
                   onClick={() => { setModelID(m.id); localStorage.setItem('ascii_model', m.id); }}>
                {m.name.toUpperCase()}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="chat-area">
        <div className="chat-header">--- # {chan.toUpperCase()} [MODEL: {modelID.split('/')[1]?.split(':')[0]}] ---</div>
        <div className="message-log">
          <div className="system-msg">{db[server].chans[chan]}</div>
          {messages.map((m, i) => (
            <div key={i} className="msg">
              <span className="msg-prefix">{m.role}: </span>
              <span className="msg-text">{m.text}</span>
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>
        <div className="input-row">
          <span className="prompt">{'>'}</span>
          <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleSend} placeholder="INPUT COMMAND..." autoFocus />
        </div>
      </div>
    </div>
  );
}