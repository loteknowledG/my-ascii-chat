import { useState, useEffect, useRef } from 'react'
import { setupAudio, playSystemSound, playLock } from './AudioEngine';
import { transmit } from './Uplink'; // Vite will automatically find .jsx
import { art, BOOT_LOGO } from './TerminalArt';
import { Memory } from './lib/memory';
import { db } from './lib/db';


export default function App() {
  const [booted, setBooted] = useState(false);
  const [server, setServer] = useState('m');
  const [chan, setChan] = useState('agenda');
  const [input, setInput] = useState('');
  const [channelData, setChannelData] = useState({ agenda: [], intel: [], logs: [] });
  const [modelList, setModelList] = useState([]);
  
  // OPENCODE ADDED TO PROVIDERS
  const providers = ['opencode', 'openrouter', 'openai']; 
  const [activeProvider, setActiveProvider] = useState(localStorage.getItem('active_provider') || 'opencode');
  
  const [keys, setKeys] = useState({
    opencode: localStorage.getItem('key_opencode') || '',
    openrouter: localStorage.getItem('key_openrouter') || '',
    openai: localStorage.getItem('key_openai') || ''
  });

  const [modelByProvider, setModelByProvider] = useState(() => ({
    opencode: localStorage.getItem('ascii_model_opencode') || '',
    openrouter: localStorage.getItem('ascii_model_openrouter') || '',
    openai: localStorage.getItem('ascii_model_openai') || ''
  }));
  const [modelHealthByProvider, setModelHealthByProvider] = useState(() => ({
    opencode: {},
    openrouter: {},
    openai: {}
  }));
  const [probeInFlightByProvider, setProbeInFlightByProvider] = useState(() => ({
    opencode: '',
    openrouter: '',
    openai: ''
  }));
  const [migrationStatus, setMigrationStatus] = useState('');
  const [memoryCount, setMemoryCount] = useState(0);
  const [memoryPreview, setMemoryPreview] = useState([]);
  const [memorySearch, setMemorySearch] = useState('');
  const [memorySearchResults, setMemorySearchResults] = useState([]);
  const [memoryViewStatus, setMemoryViewStatus] = useState('VIEW_NOT_LOADED');
  const [lastMemoryContext, setLastMemoryContext] = useState([]);
  const [memoryCollapsed, setMemoryCollapsed] = useState(() => window.matchMedia?.('(orientation: portrait)')?.matches ?? false);
  const [memoryCardDock, setMemoryCardDock] = useState('floating');
  const [memoryFullscreenCard, setMemoryFullscreenCard] = useState(null);
  const [momentDockOrder, setMomentDockOrder] = useState(() => ({
    nav: [],
    terminal: ['summary', 'tools', 'viewer']
  }));
  const [draggedMomentId, setDraggedMomentId] = useState(null);
  const [snappedMomentId, setSnappedMomentId] = useState(null);
  const memoryCardWidth = 260;
  const memoryCardHeight = 170;
  const [memoryFabPos, setMemoryFabPos] = useState(() => ({
    x: Math.max(24, Math.round((window.visualViewport?.width || window.innerWidth || 0) - memoryCardWidth - 24)),
    y: Math.max(24, Math.round((window.visualViewport?.height || window.innerHeight || 0) - memoryCardHeight - 24)),
  }));
  const [isDrawerMode, setIsDrawerMode] = useState(() => window.matchMedia?.('(max-width: 980px)')?.matches ?? false);
  const [drawerProgress, setDrawerProgress] = useState(0);
  const [drawerDragging, setDrawerDragging] = useState(false);
  const messageLogRef = useRef(null);
  const chatEndRef = useRef(null);
  const navColumnRef = useRef(null);
  const fabDragRef = useRef({ dragging: false, offsetX: 0, offsetY: 0 });
  const drawerDragRef = useRef({ dragging: false, startX: 0, startProgress: 0, didDrag: false });
  const snapPulseRef = useRef(null);
  const inputRef = useRef(null);
  const legacyInputRef = useRef(null);
  const modelID = modelByProvider[activeProvider] || '';
  const providerReady = Boolean(keys[activeProvider]);
  const isActivelyProbing = probeInFlightByProvider[activeProvider] === modelID && Boolean(modelID);
  const currentModelHealth = modelHealthByProvider[activeProvider]?.[modelID] || 'idle';
  const secondColumnSelectionLabel = server === 'm'
    ? 'ØPERATOR'
    : (chan === 'providers' ? activeProvider.toUpperCase() : chan.toUpperCase());
  const providerTint = !providerReady
    ? '#444'
    : (currentModelHealth === 'green'
      ? '#00ff00'
      : (currentModelHealth === 'testing' || currentModelHealth === 'amber'
        ? '#ffaa00'
        : '#444'));
  const drawerWidth = Math.min(340, Math.max(260, Math.round((window.visualViewport?.width || window.innerWidth || 0) * 0.78)));
  const drawerClosedX = -(drawerWidth + 16);
  const drawerTranslateX = drawerClosedX + ((drawerProgress || 0) * (0 - drawerClosedX));
  const navDrawerStyle = isDrawerMode ? {
    position: 'fixed',
    left: '80px',
    top: '12px',
    bottom: '12px',
    width: `${drawerWidth}px`,
    transform: `translateX(${drawerTranslateX}px)`,
    transition: drawerDragging ? 'none' : 'transform 180ms ease',
    borderRight: '1px solid #1a1a1a',
    padding: '16px 10px 18px',
    overflowY: 'auto',
    zIndex: 35,
    background: 'rgba(16, 16, 16, 0.98)',
    boxShadow: '18px 0 42px rgba(0, 0, 0, 0.38)',
    borderRadius: '0 18px 18px 0'
  } : {
    width: '240px',
    borderRight: '1px solid #1a1a1a',
    padding: '20px 10px',
    overflowY: 'auto'
  };

  const setModelHealth = (provider, model, status) => {
    if (!provider || !model) return;
    setModelHealthByProvider(prev => ({
      ...prev,
      [provider]: {
        ...(prev[provider] || {}),
        [model]: status
      }
    }));
  };

  const handleFabPointerDown = (event) => {
    event.preventDefault();
    const startX = event.clientX;
    const startY = event.clientY;
    const dockRect = navColumnRef.current?.getBoundingClientRect?.();
    const originX = memoryCardDock === 'nav' && dockRect ? Math.max(12, dockRect.right - memoryCardWidth - 12) : memoryFabPos.x;
    const originY = memoryCardDock === 'nav' && dockRect ? Math.max(12, dockRect.top + 140) : memoryFabPos.y;
    const offsetX = startX - originX;
    const offsetY = startY - originY;
    fabDragRef.current = { dragging: true, offsetX, offsetY, didDrag: false, currentX: originX, currentY: originY };
    setMemoryCardDock('floating');
    setMemoryFabPos({ x: originX, y: originY });

    const onMove = (moveEvent) => {
      if (!fabDragRef.current.dragging) return;
      const nextX = Math.max(12, Math.min(moveEvent.clientX - fabDragRef.current.offsetX, (window.visualViewport?.width || window.innerWidth || 0) - memoryCardWidth - 12));
      const nextY = Math.max(12, Math.min(moveEvent.clientY - fabDragRef.current.offsetY, (window.visualViewport?.height || window.innerHeight || 0) - memoryCardHeight - 12));
      if (Math.abs(moveEvent.clientX - startX) > 4 || Math.abs(moveEvent.clientY - startY) > 4) {
        fabDragRef.current.didDrag = true;
      }
      fabDragRef.current.currentX = nextX;
      fabDragRef.current.currentY = nextY;
      setMemoryFabPos({ x: nextX, y: nextY });
    };

    const onUp = () => {
      fabDragRef.current.dragging = false;
      const navRect = navColumnRef.current?.getBoundingClientRect?.();
      const cardCenter = {
        x: (fabDragRef.current.currentX ?? memoryFabPos.x) + (memoryCardWidth / 2),
        y: (fabDragRef.current.currentY ?? memoryFabPos.y) + (memoryCardHeight / 2)
      };
      if (navRect && cardCenter.x >= navRect.left && cardCenter.x <= navRect.right && cardCenter.y >= navRect.top && cardCenter.y <= navRect.bottom) {
        setMemoryCardDock('nav');
      } else {
        setMemoryCardDock('floating');
      }
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const handleDrawerPointerDown = (event) => {
    if (!isDrawerMode) return;
    event.preventDefault();
    event.stopPropagation();
    const startX = event.clientX;
    drawerDragRef.current = {
      dragging: true,
      startX,
      startProgress: drawerProgress,
      currentProgress: drawerProgress,
      didDrag: false
    };
    setDrawerDragging(true);

    const onMove = (moveEvent) => {
      if (!drawerDragRef.current.dragging) return;
      const deltaX = moveEvent.clientX - drawerDragRef.current.startX;
      if (Math.abs(deltaX) > 4) {
        drawerDragRef.current.didDrag = true;
      }
      const nextProgress = Math.max(
        0,
        Math.min(
          1,
          drawerDragRef.current.startProgress + (deltaX / Math.max(1, drawerWidth - 52))
        )
      );
      drawerDragRef.current.currentProgress = nextProgress;
      setDrawerProgress(nextProgress);
    };

    const onUp = () => {
      if (!drawerDragRef.current.dragging) return;
      const shouldOpen = (drawerDragRef.current.currentProgress ?? drawerProgress) >= 0.5;
      setDrawerProgress(shouldOpen ? 1 : 0);
      drawerDragRef.current.dragging = false;
      setDrawerDragging(false);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const probeSelectedModel = async (provider, model, key) => {
    if (!provider || !model || !key) return;

    setProbeInFlightByProvider(prev => ({ ...prev, [provider]: model }));
    setModelHealth(provider, model, 'testing');

    try {
      const res = await transmit(provider, 'chat', key, {
        model,
        messages: [
          { role: 'system', content: 'Reply with exactly OK.' },
          { role: 'user', content: 'probe' }
        ],
        max_tokens: 8,
        temperature: 0,
        stream: false
      });

      if (!res.ok) {
        const failHealth = res.status === 429 ? 'amber' : 'grey';
        setModelHealth(provider, model, failHealth);
        setChannelData(prev => ({
          ...prev,
          logs: [...prev.logs, {
            role: 'SYS',
            text: `MODEL_TEST ${provider.toUpperCase()}/${model}: HTTP_${res.status}${res.status === 429 ? ' RATE_LIMIT' : ' FAILURE'}`
          }]
        }));
        return;
      }

      const data = await res.json().catch(() => ({}));
      const content = String(data?.choices?.[0]?.message?.content || '').trim();
      const valid = content.length > 0;

      setModelHealth(provider, model, valid ? 'green' : 'amber');
      if (valid) playLock();
      setChannelData(prev => ({
        ...prev,
        logs: [...prev.logs, {
          role: 'SYS',
          text: `MODEL_TEST ${provider.toUpperCase()}/${model}: ${valid ? 'VALID_RESPONSE' : 'EMPTY_RESPONSE'}`
        }]
      }));
    } catch (err) {
      setModelHealth(provider, model, 'grey');
      setChannelData(prev => ({
        ...prev,
        logs: [...prev.logs, {
          role: 'SYS',
          text: `MODEL_TEST ${provider.toUpperCase()}/${model}: ${String(err?.message || err)}`
        }]
      }));
    } finally {
      setProbeInFlightByProvider(prev => {
        if (prev[provider] !== model) return prev;
        return { ...prev, [provider]: '' };
      });
    }
  };

  useEffect(() => { if (booted && inputRef.current) inputRef.current.focus(); }, [booted, chan, server]);
  useEffect(() => {
    if (messageLogRef.current) {
      messageLogRef.current.scrollTo({ top: messageLogRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [channelData, chan]);
  useEffect(() => {
    const clampFab = () => {
      const vw = window.visualViewport?.width || window.innerWidth || 0;
      const vh = window.visualViewport?.height || window.innerHeight || 0;
      setMemoryFabPos(prev => ({
        x: Math.max(12, Math.min(prev.x, Math.max(12, vw - memoryCardWidth - 12))),
        y: Math.max(12, Math.min(prev.y, Math.max(12, vh - memoryCardHeight - 12))),
      }));
    };

    clampFab();
    window.addEventListener('resize', clampFab);
    window.addEventListener('orientationchange', clampFab);
    window.visualViewport?.addEventListener('resize', clampFab);

    return () => {
      window.removeEventListener('resize', clampFab);
      window.removeEventListener('orientationchange', clampFab);
      window.visualViewport?.removeEventListener('resize', clampFab);
    };
  }, []);
  useEffect(() => {
    const root = document.documentElement;
    const updateViewportHeight = () => {
      const visibleHeight = Math.round(window.visualViewport?.height || window.innerHeight);
      root.style.setProperty('--app-height', `${visibleHeight}px`);
    };

    updateViewportHeight();
    window.addEventListener('resize', updateViewportHeight);
    window.addEventListener('orientationchange', updateViewportHeight);
    window.visualViewport?.addEventListener('resize', updateViewportHeight);
    window.visualViewport?.addEventListener('scroll', updateViewportHeight);

    return () => {
      window.removeEventListener('resize', updateViewportHeight);
      window.removeEventListener('orientationchange', updateViewportHeight);
      window.visualViewport?.removeEventListener('resize', updateViewportHeight);
      window.visualViewport?.removeEventListener('scroll', updateViewportHeight);
    };
  }, []);
  useEffect(() => {
    const updateDrawerMode = () => {
      const matches = window.matchMedia?.('(max-width: 980px)')?.matches ?? false;
      setIsDrawerMode(matches);
    };

    updateDrawerMode();
    window.addEventListener('resize', updateDrawerMode);
    window.addEventListener('orientationchange', updateDrawerMode);
    window.visualViewport?.addEventListener('resize', updateDrawerMode);

    return () => {
      window.removeEventListener('resize', updateDrawerMode);
      window.removeEventListener('orientationchange', updateDrawerMode);
      window.visualViewport?.removeEventListener('resize', updateDrawerMode);
    };
  }, []);
  useEffect(() => {
    if (isDrawerMode) {
      setDrawerProgress(0);
    } else {
      setDrawerProgress(1);
    }
  }, [isDrawerMode]);
  // --- FETCH MODELS LOGIC ---
  useEffect(() => {
    const fetchModels = async () => {
      const currentKey = keys[activeProvider];
      setModelList([]);
      if (!booted || !currentKey) return;
      try {
        const res = await transmit(activeProvider, 'models', keys[activeProvider]);

        if (!res.ok) throw new Error(`HTTP_${res.status}`);

        const data = await res.json();
        if (data.data) {
          const sorted = data.data.sort((a, b) => {
            const aFree = a.id.toLowerCase().includes('free');
            const bFree = b.id.toLowerCase().includes('free');
            return aFree === bFree ? 0 : aFree ? -1 : 1;
          });
          const nextList = sorted.slice(0, 50);
          setModelList(nextList);
          setModelByProvider(prev => {
            const current = prev[activeProvider] || '';
            const hasCurrent = current && nextList.some(m => m.id === current);
            const nextModel = hasCurrent ? current : (nextList[0]?.id || '');
            if (nextModel === current) return prev;
            localStorage.setItem(`ascii_model_${activeProvider}`, nextModel);
            if (nextModel) void probeSelectedModel(activeProvider, nextModel, currentKey);
            return { ...prev, [activeProvider]: nextModel };
          });
        }
      } catch (e) { 
        setModelList([]);
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
    const currentModel = modelByProvider[activeProvider] || '';
    
    if (!currentKey) {
        return setChannelData(prev => ({ ...prev, [chan]: [...prev[chan], { role: 'SYS', text: "ERROR: KEY MISSING" }] }));
    }

    if (!currentModel) {
        return setChannelData(prev => ({ ...prev, [chan]: [...prev[chan], { role: 'SYS', text: `ERROR: NO MODEL FOR ${activeProvider.toUpperCase()}` }] }));
    }

    const aiId = Date.now();
    setChannelData(prev => ({ ...prev, [chan]: [...prev[chan], { role: 'AI', text: '', id: aiId }] }));

    let systemPrompt = "You are MU/TH/UR 6000. Concise, technical.";
    if (chan === 'intel') systemPrompt = "Science Officer interface. objective data analysis.";
    if (chan === 'logs') systemPrompt = "Mission Recorder. Chronological log format.";

    let memoryContext = '';
    let memoryContextRows = [];
    try {
      const hits = await Memory.query(val, 3);
      if (hits.length) {
        memoryContextRows = hits;
        memoryContext = [
          'RELEVANT_MEMORY:',
          ...hits.map((hit, idx) => {
            const ts = hit.created_at ? new Date(hit.created_at).toLocaleString() : 'unknown time';
            return `${idx + 1}. [${hit.type}] ${ts} :: ${String(hit.text || '').slice(0, 220)}`;
          })
        ].join('\n');
      }
      setLastMemoryContext(hits);
    } catch (err) {
      console.warn('MEMORY_QUERY_ERR', err);
      setLastMemoryContext([]);
    }

    try {
      await Memory.add('chat_user', val, {
        provider: activeProvider,
        model: currentModel,
        channel: chan,
        direction: 'user'
      });
    } catch (err) {
      console.warn('MEMORY_ADD_USER_ERR', err);
    }

    const promptMessages = [
      {
        role: 'system',
        content: `${systemPrompt}\n${memoryContext ? `\n${memoryContext}\n` : '\n'}Use relevant memory as background only.`
      },
      { role: 'user', content: val }
    ];
    
    try {
      let endpoint = '';
      if (activeProvider === 'openai') {
        endpoint = 'https://api.openai.com/v1/chat/completions';
      } else if (activeProvider === 'opencode') {
        endpoint = 'https://opencode.ai/zen/v1/chat/completions'; // FIXED ENDPOINT
      } else {
        endpoint = 'https://openrouter.ai/api/v1/chat/completions';
      }

      // NEW MODULAR TRANSMIT
      const res = await transmit(activeProvider, 'chat', keys[activeProvider], {
        model: currentModel,
        messages: promptMessages,
        stream: true
      });

      if (!res.ok) throw new Error(`HTTP_${res.status}`);

      const reader = res.body.getReader();
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
            // ... inside your while(true) loop
            const parsed = JSON.parse(cleaned);
            const content = parsed.choices[0]?.delta?.content || "";

            if (content) {
              fullContent += content;

              // --- SAFETY SHIELD START ---
              // 1. Emergency Truncate: If AI goes over 5000 chars, force a stop
              if (fullContent.length > 5000) {
                fullContent = fullContent.substring(0, 5000) + "\n\n[SYSTEM: BUFFER_OVERFLOW_DETECTION]";
                reader.cancel(); // Physically stops the stream from the server
              }

              // 2. Repetition Filter: Detects if the same character repeats 50+ times (like the smileys)
              const repetitivePattern = /(.)\1{50,}/g;
              if (repetitivePattern.test(fullContent)) {
                fullContent = fullContent.replace(repetitivePattern, "$1... [REPETITIVE_SIGNAL_FILTERED]");
                reader.cancel(); // Stops the AI from wasting more tokens
              }
              // --- SAFETY SHIELD END ---

              playSystemSound('click', 0.05); 
              setChannelData(prev => ({
                ...prev, 
                [chan]: prev[chan].map(m => m.id === aiId ? { ...m, text: fullContent } : m)
              }));
            }
          } catch (e) {}
        }
      }

      if (fullContent.trim()) {
        try {
          await Memory.add('chat_ai', fullContent.trim(), {
            provider: activeProvider,
            model: currentModel,
            channel: chan,
            direction: 'assistant'
          });
        } catch (err) {
          console.warn('MEMORY_ADD_AI_ERR', err);
        }
      }
    } catch (err) {
      setChannelData(prev => ({ ...prev, [chan]: [...prev[chan], { role: 'SYS', text: `UPLINK ERR: ${err.message}` }] }));
    }
  };

  const handleLegacyImport = async () => {
    const file = legacyInputRef.current?.files?.[0];
    if (!file) {
      setMigrationStatus('SELECT_A_JSON_FILE_FIRST');
      return;
    }

    setMigrationStatus('IMPORTING...');
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const count = await Memory.importLegacyData(data, { overwrite: false });
      setMigrationStatus(`IMPORTED_${count}_RECORDS`);
      playSystemSound('chirp');
      await loadMemoryPreview();
    } catch (err) {
      setMigrationStatus(`IMPORT_ERR_${err.message}`);
    }
  };

  const handleLegacyPurge = async () => {
    const ok = window.confirm('PURGE imported legacy memories? This removes the SQLite import rows only.');
    if (!ok) return;

    setMigrationStatus('PURGING_LEGACY_ROWS...');
    try {
      const removed = await Memory.purgeLegacyData();
      setMigrationStatus(`PURGED_${removed}_LEGACY_ROWS`);
      playSystemSound('chirp');
      setMemorySearch('');
      setMemorySearchResults([]);
      await loadMemoryPreview();
    } catch (err) {
      setMigrationStatus(`PURGE_ERR_${err.message}`);
    }
  };

  const loadMemoryPreview = async () => {
    setMemoryViewStatus('LOADING...');
    try {
      const [count, recent] = await Promise.all([
        db.memories.count(),
        db.memories.orderBy('created_at').reverse().limit(6).toArray(),
      ]);
      setMemoryCount(count);
      setMemoryPreview(recent);
      setMemoryViewStatus('READY');
    } catch (err) {
      setMemoryViewStatus(`ERROR_${err.message}`);
    }
  };

  const runMemorySearch = async () => {
    const term = memorySearch.trim().toLowerCase();
    if (!term) {
      setMemoryViewStatus('ENTER_A_SEARCH_TERM');
      setMemorySearchResults([]);
      return;
    }

    setMemoryViewStatus(`SEARCHING_${term}`);
    try {
      const results = await Memory.query(term, 25);
      setMemorySearchResults(results);
      setMemoryViewStatus(`FOUND_${results.length}`);
    } catch (err) {
      setMemoryViewStatus(`SEARCH_ERR_${err.message}`);
    }
  };

  const widgetCardStyle = {
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
    minHeight: '168px',
    aspectRatio: '1 / 1',
    breakInside: 'avoid',
    marginBottom: '8px',
    padding: '8px',
    border: '1px solid #1f1f1f',
    borderRadius: '12px',
    background: 'linear-gradient(180deg, rgba(10,10,10,0.98), rgba(6,6,6,0.98))',
    boxShadow: '0 10px 24px rgba(0, 0, 0, 0.22)',
    overflow: 'hidden'
  };
  const widgetTitleStyle = {
    fontSize: '9px',
    letterSpacing: '0.08em',
    marginBottom: '6px'
  };
  const widgetFlowStyle = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
    gap: '7px',
    gridAutoFlow: 'dense'
  };
  const fullscreenIconButtonStyle = {
    width: '22px',
    height: '22px',
    padding: 0,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#111',
    border: '1px solid #2a2a2a',
    color: '#78b8ff',
    cursor: 'pointer',
    borderRadius: '6px',
    flex: '0 0 auto'
  };
  const summaryTopHit = lastMemoryContext?.[0];
  const memoryCardOrder = ['live', 'summary', 'tools', 'viewer'];
  const moveFullscreenCard = (direction) => {
    if (!memoryFullscreenCard) return;
    const index = memoryCardOrder.indexOf(memoryFullscreenCard);
    if (index < 0) return;
    const nextIndex = (index + direction + memoryCardOrder.length) % memoryCardOrder.length;
    setMemoryFullscreenCard(memoryCardOrder[nextIndex]);
  };
  const setMemoryDockWithSnap = (nextDock) => {
    setMemoryCardDock(nextDock);
    if (nextDock === 'nav') {
      playLock();
    } else {
      playSystemSound('click', 0.04);
    }
  };
  const pulseMomentSnap = (momentId) => {
    if (snapPulseRef.current) {
      window.clearTimeout(snapPulseRef.current);
    }
    setSnappedMomentId(momentId);
    snapPulseRef.current = window.setTimeout(() => setSnappedMomentId(null), 180);
  };
  const reorderMomentDock = (dockKey, fromId, toId) => {
    setMomentDockOrder(prev => {
      const current = Array.isArray(prev[dockKey]) ? prev[dockKey] : [];
      const fromIndex = current.indexOf(fromId);
      const toIndex = current.indexOf(toId);
      if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return prev;
      const next = current.slice();
      next.splice(fromIndex, 1);
      next.splice(toIndex, 0, fromId);
      return { ...prev, [dockKey]: next };
    });
  };
  const handleMomentDragStart = (event, momentId) => {
    event.stopPropagation();
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', momentId);
    setDraggedMomentId(momentId);
  };
  const handleMomentDragOver = (event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  };
  const handleMomentDrop = (event, momentId, dockKey = 'terminal') => {
    event.preventDefault();
    event.stopPropagation();
    const fromId = event.dataTransfer.getData('text/plain') || draggedMomentId;
    if (fromId && fromId !== momentId) {
      reorderMomentDock(dockKey, fromId, momentId);
      playLock();
      pulseMomentSnap(momentId);
    } else if (fromId === momentId) {
      playLock();
      pulseMomentSnap(momentId);
    }
    setDraggedMomentId(null);
  };
  const handleMomentDragEnd = (momentId) => {
    setDraggedMomentId(null);
    if (momentId) pulseMomentSnap(momentId);
  };
  const getMomentWidgetStyle = (momentId) => ({
    ...widgetCardStyle,
    cursor: 'grab',
    transform: draggedMomentId === momentId
      ? 'translateY(-7px) scale(1.015)'
      : snappedMomentId === momentId
        ? 'translateY(1px) scale(0.99)'
        : 'none',
    boxShadow: draggedMomentId === momentId
      ? '0 18px 30px rgba(0,0,0,0.32), 0 0 0 1px rgba(155,255,155,0.12) inset'
      : snappedMomentId === momentId
        ? 'inset 0 0 0 1px rgba(255,255,255,0.10), 0 6px 14px rgba(0,0,0,0.18)'
        : widgetCardStyle.boxShadow,
    transition: 'transform 120ms ease, box-shadow 120ms ease, opacity 120ms ease',
    opacity: draggedMomentId && draggedMomentId !== momentId ? 0.94 : 1,
    willChange: draggedMomentId === momentId ? 'transform' : 'auto'
  });
  const renderLiveMemoryCard = (mode = 'floating') => {
    const isDocked = mode === 'nav';
    const isFullscreen = mode === 'fullscreen';
    const cardStyle = isFullscreen ? {
      width: '100%',
      minHeight: '100%',
      aspectRatio: 'auto',
      ...widgetCardStyle,
      cursor: 'grab'
    } : isDocked ? {
      ...widgetCardStyle,
      cursor: 'grab'
    } : {
      ...widgetCardStyle,
      position: 'fixed',
      left: `${memoryFabPos.x}px`,
      top: `${memoryFabPos.y}px`,
      width: `${memoryCardWidth}px`,
      minHeight: `${memoryCardHeight}px`,
      zIndex: 42,
      cursor: 'grab'
    };
    return (
      <div style={cardStyle} onPointerDown={handleFabPointerDown}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
          <div style={{ color: '#9bff9b', fontSize: '10px', letterSpacing: '0.08em' }}>LIVE_HANGOUT</div>
          <div style={{ display: 'flex', gap: '4px' }}>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setMemoryFullscreenCard('live'); }}
              style={fullscreenIconButtonStyle}
              aria-label="Open live hangout fullscreen"
              title="Fullscreen"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M8 3H5a2 2 0 0 0-2 2v3" />
                <path d="M16 3h3a2 2 0 0 1 2 2v3" />
                <path d="M8 21H5a2 2 0 0 1-2-2v-3" />
                <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
              </svg>
            </button>
            {isDocked ? (
              <button type="button" onClick={(e) => { e.stopPropagation(); setMemoryCardDock('floating'); }} style={{ padding: '3px 6px', background: '#111', color: '#78b8ff', border: '1px solid #2a2a2a', cursor: 'pointer', fontFamily: 'monospace', fontSize: '8px' }}>FLOAT</button>
            ) : (
              <button type="button" onClick={(e) => { e.stopPropagation(); setMemoryCardDock('nav'); }} style={{ padding: '3px 6px', background: '#111', color: '#78b8ff', border: '1px solid #2a2a2a', cursor: 'pointer', fontFamily: 'monospace', fontSize: '8px' }}>DOCK</button>
            )}
          </div>
        </div>
        <div style={{ color: '#ddd', fontSize: '9px', lineHeight: 1.45, overflowY: 'auto', flex: 1 }}>
          <div>ROWS: {memoryCount}</div>
          <div>TOPK: {lastMemoryContext.length}</div>
          <div>STATE: {memoryViewStatus}</div>
          <div style={{ marginTop: '6px', color: '#78b8ff' }}>{summaryTopHit ? `#${summaryTopHit.id} ${summaryTopHit.type}` : 'NO LIVE HITS'}</div>
        </div>
      </div>
    );
  };
  const summaryMemoryCard = (
      <div style={widgetCardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
          <div style={{ ...widgetTitleStyle, color: '#78b8ff', marginBottom: 0 }}>MEMORY_SUMMARY</div>
        <button
          type="button"
          onClick={() => setMemoryFullscreenCard('summary')}
          style={fullscreenIconButtonStyle}
          aria-label="Open memory summary fullscreen"
          title="Fullscreen"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M8 3H5a2 2 0 0 0-2 2v3" />
            <path d="M16 3h3a2 2 0 0 1 2 2v3" />
            <path d="M8 21H5a2 2 0 0 1-2-2v-3" />
            <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
          </svg>
        </button>
        </div>
      <div style={{ color: '#bbb', fontSize: '9px', lineHeight: 1.45, overflowY: 'auto', flex: 1 }}>
        <div>VISIBLE: {memoryPreview.length}</div>
        <div>SEARCH: {memorySearch.trim() ? 'ON' : 'OFF'}</div>
        <div>STATUS: {memoryViewStatus}</div>
        <div>HITS: {memorySearchResults.length || memoryPreview.length}</div>
      </div>
    </div>
  );
  const toolsMemoryCard = (
      <div style={widgetCardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
          <div style={{ ...widgetTitleStyle, color: '#ffaa00', marginBottom: 0 }}>MEMORY_TOOLS</div>
        <button
          type="button"
          onClick={() => setMemoryFullscreenCard('tools')}
          style={fullscreenIconButtonStyle}
          aria-label="Open memory tools fullscreen"
          title="Fullscreen"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M8 3H5a2 2 0 0 0-2 2v3" />
            <path d="M16 3h3a2 2 0 0 1 2 2v3" />
            <path d="M8 21H5a2 2 0 0 1-2-2v-3" />
            <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
          </svg>
        </button>
        </div>
      <div style={{ display: 'grid', gap: '6px', overflowY: 'auto', flex: 1 }}>
        <input ref={legacyInputRef} type="file" accept=".json,application/json" style={{ width: '100%', fontSize: '9px', color: '#ccc' }} />
        <button type="button" onClick={handleLegacyImport} style={{ width: '100%', padding: '6px 8px', background: '#111', color: '#ffaa00', border: '1px solid #333', cursor: 'pointer', fontFamily: 'monospace', fontSize: '9px' }}>IMPORT LEGACY JSON</button>
        <button type="button" onClick={handleLegacyPurge} style={{ width: '100%', padding: '6px 8px', background: '#1a0909', color: '#ff4444', border: '1px solid #442222', cursor: 'pointer', fontFamily: 'monospace', fontSize: '9px' }}>PURGE LEGACY ROWS</button>
        <div style={{ marginTop: '2px', fontSize: '9px', color: '#666', wordBreak: 'break-word' }}>{migrationStatus || 'LOAD memory_for_dexie.json'}</div>
      </div>
    </div>
  );
  const viewerMemoryCard = (
      <div style={widgetCardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
          <div style={{ ...widgetTitleStyle, color: '#78b8ff', marginBottom: 0 }}>MEMORY_VIEWER</div>
        <button
          type="button"
          onClick={() => setMemoryFullscreenCard('viewer')}
          style={fullscreenIconButtonStyle}
          aria-label="Open memory viewer fullscreen"
          title="Fullscreen"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M8 3H5a2 2 0 0 0-2 2v3" />
            <path d="M16 3h3a2 2 0 0 1 2 2v3" />
            <path d="M8 21H5a2 2 0 0 1-2-2v-3" />
            <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
          </svg>
        </button>
        </div>
      <button type="button" onClick={() => void loadMemoryPreview()} style={{ width: '100%', padding: '6px 8px', background: '#111', color: '#78b8ff', border: '1px solid #333', cursor: 'pointer', fontFamily: 'monospace', fontSize: '9px', marginBottom: '6px' }}>REFRESH VIEW</button>
      <div style={{ marginBottom: '6px', fontSize: '9px', color: '#666' }}>{memoryViewStatus} / {memoryCount} RECORDS</div>
      <div style={{ display: 'flex', gap: '6px' }}>
        <input value={memorySearch} onChange={(e) => setMemorySearch(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void runMemorySearch(); }} placeholder="SEARCH memories..." style={{ flex: 1, minWidth: 0, padding: '6px 8px', background: '#0b0b0b', color: '#78b8ff', border: '1px solid #333', fontFamily: 'monospace', fontSize: '9px', outline: 'none' }} />
        <button type="button" onClick={() => void runMemorySearch()} style={{ padding: '6px 8px', background: '#111', color: '#78b8ff', border: '1px solid #333', cursor: 'pointer', fontFamily: 'monospace', fontSize: '9px' }}>FIND</button>
      </div>
      <div style={{ marginTop: '6px', overflowY: 'auto', flex: 1, fontSize: '9px', color: '#bbb' }}>
        {memorySearch.trim() ? (
          memorySearchResults.length === 0 ? (
            <div style={{ color: '#444' }}>NO_SEARCH_MATCHES</div>
          ) : (
            memorySearchResults.slice(0, 3).map((item) => (
              <div key={`search-${item.id}`} style={{ marginBottom: '8px', paddingBottom: '8px', borderBottom: '1px solid #1a1a1a' }}>
                <div style={{ color: '#78b8ff' }}>#{item.id} {item.type}</div>
                <div style={{ color: '#888' }}>{(item.tags || []).slice(0, 4).join(', ') || '-'}</div>
              </div>
            ))
          )
        ) : memoryPreview.length === 0 ? (
          <div style={{ color: '#444' }}>NO_MEMORY_ROWS_LOADED</div>
        ) : (
          memoryPreview.slice(0, 3).map((item) => (
            <div key={item.id} style={{ marginBottom: '8px', paddingBottom: '8px', borderBottom: '1px solid #1a1a1a' }}>
              <div style={{ color: '#00ff00' }}>#{item.id} {item.type}</div>
              <div style={{ color: '#888' }}>{(item.tags || []).slice(0, 4).join(', ') || '-'}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
  const memoryPanels = (
    <div style={widgetFlowStyle}>
      {summaryMemoryCard}
      {toolsMemoryCard}
      {viewerMemoryCard}
    </div>
  );

  if (!booted) {
    return (
      <>
        <div className="boot-screen" onClick={() => { 
          setupAudio(); // This initializes the context safely inside the module
          setBooted(true); 
        }} style={{ height: 'var(--app-height, 100vh)', backgroundColor: '#000', color: '#00ff00', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontFamily: 'monospace' }}>
          <pre>{`[ COGNOSYS ]\n[ MU/TH/UR 6000 ]\n\n>> INITIALIZE UPLINK <<`}</pre>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="ui-wrapper terminal-window" onClick={() => setupAudio()} style={{ backgroundColor: '#000', color: '#00ff00', height: 'var(--app-height, 100vh)', display: 'flex', fontFamily: 'monospace', overflow: 'hidden', fontSize: '14px' }}>
      
      {/* COL 1: SERVERS */}
      <div className="sidebar-servers" style={{ width: '92px', borderRight: '1px solid #1a1a1a', padding: '10px' }}>
        {[
          { id: 'm', label: 'Operator', glyph: 'Ø' },
          { id: 's', label: 'Mainnet-Uplink', glyph: 'μ' }
        ].map(button => (
          <div key={button.id} onClick={() => { setServer(button.id); setChan(button.id === 'm' ? 'agenda' : 'providers'); playSystemSound('chirp'); }} style={{ marginBottom: '18px', cursor: 'pointer' }}>
            <pre style={{ margin: 0, color: server === button.id ? '#00ff00' : '#222' }}>{server === button.id ? art.pushed(button.label, button.glyph) : art.popped(button.label, button.glyph)}</pre>
          </div>
        ))}
      </div>

      {/* COL 2: NAV */}
      <div
        ref={navColumnRef}
        className={`sidebar-channels${isDrawerMode ? ' sidebar-drawer' : ''}`}
        style={navDrawerStyle}
      >
        <div style={{ color: '#444', fontSize: '10px', marginBottom: '10px' }}>{server === 'm' ? 'ØPERATOR' : 'MAINNET-UPLINK'}</div>
        {server === 'm' ? (
          ['agenda', 'intel', 'logs'].map(c => (
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
                {!keys[activeProvider] ? (
                  <div style={{ color: '#444', fontSize: '10px', lineHeight: 1.4 }}>
                    ENTER A KEY ABOVE TO LOAD {activeProvider.toUpperCase()} MODELS.
                  </div>
                ) : modelList.length === 0 ? (
                  <div style={{ color: '#444', fontSize: '10px' }}>
                    NO_MODELS_LOADED
                  </div>
                ) : (
                  modelList.map(m => (
                    <div
                      key={m.id}
                      onClick={() => {
                        setModelByProvider(prev => ({ ...prev, [activeProvider]: m.id }));
                        localStorage.setItem(`ascii_model_${activeProvider}`, m.id);
                        playSystemSound('click');
                        void probeSelectedModel(activeProvider, m.id, keys[activeProvider]);
                      }}
                      style={{
                        cursor: 'pointer',
                        color: modelID === m.id
                          ? (modelHealthByProvider[activeProvider]?.[m.id] === 'green'
                            ? '#00ff00'
                            : (modelHealthByProvider[activeProvider]?.[m.id] === 'amber'
                              ? '#ffaa00'
                              : '#444'))
                          : (m.id.includes('free') ? '#ffaa00' : '#222'),
                        fontSize: '10px',
                        padding: '4px 0',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {m.id.split('/').pop()}
                    </div>
                  ))
                )}
            </div>
            {server === 'm' && chan === 'intel' && (
              <div style={{ marginTop: '14px' }}>
                <div style={{ color: '#444', fontSize: '10px', marginBottom: '8px' }}>MOMENTS_GRID</div>
                <div style={widgetFlowStyle}>
                  {memoryCardDock === 'nav' ? renderLiveMemoryCard('nav') : (
                    <div style={{ ...widgetCardStyle, justifyContent: 'center', alignItems: 'center', color: '#444', textAlign: 'center' }}>
                      DRAG LIVE HANGOUT HERE
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* COL 3: TERMINAL */}
      <div className="chat-area" style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '20px' }}>
        <div
          className={isActivelyProbing ? 'model-probe-wave' : ''}
          style={{ color: providerTint, fontSize: '10px', marginBottom: '20px' }}
        >
          {secondColumnSelectionLabel} // {modelID || 'NO_MODEL'}
        </div>

        {server === 'm' && chan === 'intel' && memoryCardDock !== 'nav' && renderLiveMemoryCard('floating')}

        {server === 'm' && chan === 'intel' && (
          <div style={{ marginBottom: '14px', marginTop: memoryCardDock === 'nav' ? '0' : '12px' }}>
            <div style={{ color: '#444', fontSize: '10px', marginBottom: '8px', letterSpacing: '0.08em' }}>MOMENTS_GRID</div>
            {memoryPanels}
          </div>
        )}
        
        <div
          ref={messageLogRef}
          className="message-log"
          style={{ flex: 1, minHeight: 0, overflowY: 'auto', marginBottom: '20px' }}
        >
          {(channelData[chan] || []).map((m, i) => (
            <div key={i} style={{ marginBottom: '15px' }}><span style={{ color: m.role === 'AI' ? '#00ff00' : (m.role === 'SYS' ? '#ffaa00' : '#444') }}>[{m.role}]</span> {m.text}</div>
          ))}
          <div ref={chatEndRef} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', borderTop: '1px solid #1a1a1a', paddingTop: '8px', minHeight: '40px' }}>
          <span style={{ marginRight: '10px' }}>{'>'}</span>
          <input 
            ref={inputRef} value={input} 
            onChange={(e) => { setInput(e.target.value); playSystemSound('click', 0.04); }} 
            onKeyDown={handleSend} placeholder={chan === 'providers' ? "ENTER GATEWAY KEY..." : "MESSAGE MU/TH/UR..."} 
            style={{ background: 'none', border: 'none', color: '#00ff00', outline: 'none', flex: 1, fontFamily: 'monospace', fontSize: '14px', lineHeight: '20px', height: '22px' }} 
          />
        </div>
      </div>
      </div>

      {memoryFullscreenCard && server === 'm' && chan === 'intel' && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 80,
            background: 'rgba(0, 0, 0, 0.92)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}
          onClick={(e) => {
            e.stopPropagation();
            setMemoryFullscreenCard(null);
          }}
        >
          <div
            style={{
              width: 'min(1100px, 100%)',
              maxHeight: '100%',
              overflow: 'auto',
              border: '1px solid #1f1f1f',
              borderRadius: '16px',
              background: '#050505',
              padding: '18px'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div style={{ color: '#9bff9b', fontSize: '10px', letterSpacing: '0.08em' }}>
                {memoryFullscreenCard === 'live' ? 'LIVE_HANGOUT_FULLSCREEN' : `MEMORY_${String(memoryFullscreenCard || '').toUpperCase()}_FULLSCREEN`}
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  type="button"
                  onClick={() => moveFullscreenCard(-1)}
                  style={{ padding: '6px 10px', background: '#111', color: '#78b8ff', border: '1px solid #2a2a2a', cursor: 'pointer', fontFamily: 'monospace', fontSize: '10px' }}
                >
                  PREV
                </button>
                <button
                  type="button"
                  onClick={() => moveFullscreenCard(1)}
                  style={{ padding: '6px 10px', background: '#111', color: '#78b8ff', border: '1px solid #2a2a2a', cursor: 'pointer', fontFamily: 'monospace', fontSize: '10px' }}
                >
                  NEXT
                </button>
                <button
                  type="button"
                  onClick={() => setMemoryFullscreenCard(null)}
                  style={{ padding: '6px 10px', background: '#111', color: '#9bff9b', border: '1px solid #2a2a2a', cursor: 'pointer', fontFamily: 'monospace', fontSize: '10px' }}
                >
                  CLOSE
                </button>
              </div>
            </div>
            <div style={{ display: 'grid', gap: '10px', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
              {memoryFullscreenCard === 'live' && renderLiveMemoryCard('fullscreen')}
              {memoryFullscreenCard === 'summary' && summaryMemoryCard}
              {memoryFullscreenCard === 'tools' && toolsMemoryCard}
              {memoryFullscreenCard === 'viewer' && viewerMemoryCard}
            </div>
          </div>
        </div>
      )}

    </>
  );
}
