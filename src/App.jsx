import { cloneElement, useState, useEffect, useRef } from "react";
import {
  setupAudio,
  playSystemSound,
  playLock,
  playSnapLock,
} from "./AudioEngine";
import { transmit } from "./Uplink"; // Vite will automatically find .jsx
import { art, BOOT_LOGO } from "./TerminalArt";
import { Memory } from "./lib/memory";
import { db } from "./lib/db";
import MemoryMomentCard from "./components/MemoryMomentCard";
import JustifiedMasonry from "./components/JustifiedMasonry";
import TerminalColumn from "./components/TerminalColumn";
import MemoryFullscreenOverlay from "./components/MemoryFullscreenOverlay";

export default function App() {
  const [booted, setBooted] = useState(false);
  const [bootFrame, setBootFrame] = useState(0);
  const [server, setServer] = useState("m");
  const [chan, setChan] = useState("agenda");
  const [input, setInput] = useState("");
  const [channelData, setChannelData] = useState({
    agenda: [],
    intel: [],
    logs: [],
    providers: [],
    "samus-manus": [],
  });
  const [modelList, setModelList] = useState([]);

  // OPENCODE ADDED TO PROVIDERS
  const providers = ["opencode", "openrouter", "openai"];
  const [activeProvider, setActiveProvider] = useState(
    localStorage.getItem("active_provider") || "opencode",
  );

  const [keys, setKeys] = useState({
    opencode: localStorage.getItem("key_opencode") || "",
    openrouter: localStorage.getItem("key_openrouter") || "",
    openai: localStorage.getItem("key_openai") || "",
  });

  const [modelByProvider, setModelByProvider] = useState(() => ({
    opencode: localStorage.getItem("ascii_model_opencode") || "",
    openrouter: localStorage.getItem("ascii_model_openrouter") || "",
    openai: localStorage.getItem("ascii_model_openai") || "",
  }));
  const [modelHealthByProvider, setModelHealthByProvider] = useState(() => ({
    opencode: {},
    openrouter: {},
    openai: {},
  }));
  const [modelFetchStatusByProvider, setModelFetchStatusByProvider] = useState(
    () => ({
      opencode: "idle",
      openrouter: "idle",
      openai: "idle",
    }),
  );
  const [probeInFlightByProvider, setProbeInFlightByProvider] = useState(
    () => ({
      opencode: "",
      openrouter: "",
      openai: "",
    }),
  );
  const [networkEvents, setNetworkEvents] = useState([]);
  const [migrationStatus, setMigrationStatus] = useState("");
  const [selectedLegacyFileName, setSelectedLegacyFileName] = useState("");
  const [memoryCount, setMemoryCount] = useState(0);
  const [memoryPreview, setMemoryPreview] = useState([]);
  const [memorySearch, setMemorySearch] = useState("");
  const [memorySearchResults, setMemorySearchResults] = useState([]);
  const [memoryViewStatus, setMemoryViewStatus] = useState("VIEW_NOT_LOADED");
  const [lastMemoryContext, setLastMemoryContext] = useState([]);
  const [memoryCollapsed, setMemoryCollapsed] = useState(
    () => window.matchMedia?.("(orientation: portrait)")?.matches ?? false,
  );
  const [memoryFullscreenCard, setMemoryFullscreenCard] = useState(null);
  const [momentDockOrder, setMomentDockOrder] = useState(() => ({
    nav: [],
    terminal: ["live", "summary", "tools", "viewer"],
  }));
  const [draggedMomentId, setDraggedMomentId] = useState(null);
  const [snappedMomentId, setSnappedMomentId] = useState(null);
  const [isDrawerMode, setIsDrawerMode] = useState(
    () => window.matchMedia?.("(max-width: 980px)")?.matches ?? false,
  );
  const [drawerProgress, setDrawerProgress] = useState(0);
  const [drawerDragging, setDrawerDragging] = useState(false);
  const [pressedRowId, setPressedRowId] = useState(null);
  const messageLogRef = useRef(null);
  const chatEndRef = useRef(null);
  const navColumnRef = useRef(null);
  const drawerDragRef = useRef({
    dragging: false,
    startX: 0,
    startProgress: 0,
    didDrag: false,
  });
  const snapPulseRef = useRef(null);
  const inputRef = useRef(null);
  const legacyInputRef = useRef(null);
  const modelID = modelByProvider[activeProvider] || "";
  const providerReady = Boolean(keys[activeProvider]);
  const isActivelyProbing =
    probeInFlightByProvider[activeProvider] === modelID && Boolean(modelID);
  const inactiveTextColor = "#7a7a7a";

  const handleRowClick = (rowId, isAlreadySelected, callback) => {
    // Trigger press animation
    setPressedRowId(rowId);
    setTimeout(() => setPressedRowId(null), 150);

    // Play sound feedback for selected tab clicks
    if (isAlreadySelected) {
      playSystemSound("chirp");
    }

    // Execute the callback
    callback();
  };
  const inactiveSubtleTextColor = "#6a6a6a";
  const activeTextGlow = "0 0 8px rgba(0, 255, 0, 0.22)";
  const amberTextGlow = "0 0 8px rgba(255, 170, 0, 0.22)";
  const inactiveTextGlow = "0 0 6px rgba(180, 180, 180, 0.14)";
  const providerModelFetchStatus =
    modelFetchStatusByProvider[activeProvider] || "idle";
  const isRetrievingModels = providerModelFetchStatus === "retrieving";
  const providerStatusLabel = !providerReady
    ? "KEY_REQUIRED"
    : providerModelFetchStatus === "retrieving"
      ? "CONNECTING... RETRIEVING_MODELS"
      : providerModelFetchStatus === "invalid-key"
        ? "INVALID_KEY"
        : providerModelFetchStatus === "error"
          ? "UPLINK_ERROR"
          : providerModelFetchStatus === "ready"
            ? "MODELS_READY"
            : "IDLE";
  const providerStatusColor = !providerReady
    ? inactiveTextColor
    : providerModelFetchStatus === "retrieving"
      ? "#ffaa00"
      : providerModelFetchStatus === "invalid-key"
        ? "#ff5555"
        : providerModelFetchStatus === "error"
          ? "#ff7a7a"
          : "#00ff00";
  const currentModelHealth =
    modelHealthByProvider[activeProvider]?.[modelID] || "idle";
  const serverLabelById = {
    m: "OPERATOR",
    s: "MAINNET-UPLINK",
    b: "SAMUS-MANUS",
  };
  const defaultChannelByServer = {
    m: "agenda",
    s: "providers",
    b: "samus-manus",
  };
  const secondColumnSelectionLabel =
    server === "m"
      ? chan.toUpperCase()
      : server === "s"
        ? chan === "providers"
          ? "GATEWAY"
          : chan.toUpperCase()
        : "VOICE";
  const providerTint = !providerReady
    ? inactiveTextColor
    : currentModelHealth === "green"
      ? "#00ff00"
      : currentModelHealth === "testing" || currentModelHealth === "amber"
        ? "#ffaa00"
        : inactiveTextColor;
  const providerTintGlow = !providerReady
    ? inactiveTextGlow
    : currentModelHealth === "green"
      ? activeTextGlow
      : currentModelHealth === "testing" || currentModelHealth === "amber"
        ? amberTextGlow
        : inactiveTextGlow;
  const actionableNetworkStatuses = new Set([
    "Disconnected",
    "Connection failed",
    "Uplink error",
    "Network disconnected",
    "Rate limit for model hit",
    "Model probe failed",
    "Model probe error",
  ]);
  const drawerWidth = Math.min(
    340,
    Math.max(
      260,
      Math.round(
        (window.visualViewport?.width || window.innerWidth || 0) * 0.78,
      ),
    ),
  );
  const drawerClosedX = -(drawerWidth + 16);
  const drawerTranslateX =
    drawerClosedX + (drawerProgress || 0) * (0 - drawerClosedX);
  const navDrawerStyle = isDrawerMode
    ? {
        position: "fixed",
        left: "72px",
        top: "12px",
        bottom: "12px",
        width: `${Math.min(300, drawerWidth)}px`,
        transform: `translateX(${drawerTranslateX}px)`,
        transition: drawerDragging ? "none" : "transform 180ms ease",
        borderRight: "1px solid #1a1a1a",
        padding: "14px 10px 16px",
        overflowY: "auto",
        zIndex: 35,
        background: "rgba(16, 16, 16, 0.98)",
        boxShadow: "18px 0 42px rgba(0, 0, 0, 0.38)",
        borderRadius: "0 18px 18px 0",
      }
    : {
        width: "224px",
        borderRight: "1px solid #1a1a1a",
        padding: "18px 10px",
        overflowY: "auto",
      };

  const setModelHealth = (provider, model, status) => {
    if (!provider || !model) return;
    setModelHealthByProvider((prev) => ({
      ...prev,
      [provider]: {
        ...(prev[provider] || {}),
        [model]: status,
      },
    }));
  };

  const pushNetworkEvent = (provider, status, detail = "") => {
    const ts = new Date().toLocaleTimeString([], { hour12: false });
    const text = detail ? `${status} // ${detail}` : status;
    setNetworkEvents((prev) =>
      [
        { id: `${Date.now()}_${Math.random()}`, provider, text, ts },
        ...prev,
      ].slice(0, 80),
    );
    if (!actionableNetworkStatuses.has(status)) return;
    setChannelData((prev) => ({
      ...prev,
      providers: [
        ...(prev.providers || []),
        { role: "SYS", text: `${ts} NET ${provider.toUpperCase()} :: ${text}` },
      ],
      logs: [
        ...(prev.logs || []),
        { role: "SYS", text: `${ts} NET ${provider.toUpperCase()} :: ${text}` },
      ],
    }));
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
      didDrag: false,
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
          drawerDragRef.current.startProgress +
            deltaX / Math.max(1, drawerWidth - 52),
        ),
      );
      drawerDragRef.current.currentProgress = nextProgress;
      setDrawerProgress(nextProgress);
    };

    const onUp = () => {
      if (!drawerDragRef.current.dragging) return;
      const shouldOpen =
        (drawerDragRef.current.currentProgress ?? drawerProgress) >= 0.5;
      setDrawerProgress(shouldOpen ? 1 : 0);
      drawerDragRef.current.dragging = false;
      setDrawerDragging(false);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const probeSelectedModel = async (provider, model, key) => {
    if (!provider || !model || !key) return;

    setProbeInFlightByProvider((prev) => ({ ...prev, [provider]: model }));
    setModelHealth(provider, model, "testing");
    pushNetworkEvent(provider, "MODEL_PROBE", model);

    try {
      const res = await transmit(provider, "chat", key, {
        model,
        messages: [
          { role: "system", content: "Reply with exactly OK." },
          { role: "user", content: "probe" },
        ],
        max_tokens: 8,
        temperature: 0,
        stream: false,
      });

      if (!res.ok) {
        const failHealth = res.status === 429 ? "amber" : "grey";
        setModelHealth(provider, model, failHealth);
        if (res.status === 429) {
          pushNetworkEvent(provider, "Rate limit for model hit", model);
        } else {
          pushNetworkEvent(
            provider,
            "Model probe failed",
            `HTTP ${res.status}`,
          );
        }
        setChannelData((prev) => ({
          ...prev,
          logs: [
            ...prev.logs,
            {
              role: "SYS",
              text: `MODEL_TEST ${provider.toUpperCase()}/${model}: HTTP_${res.status}${res.status === 429 ? " RATE_LIMIT" : " FAILURE"}`,
            },
          ],
        }));
        return;
      }

      const data = await res.json().catch(() => ({}));
      const content = String(data?.choices?.[0]?.message?.content || "").trim();
      const valid = content.length > 0;

      setModelHealth(provider, model, valid ? "green" : "amber");
      pushNetworkEvent(
        provider,
        valid ? "MODEL_CONNECTED" : "MODEL_EMPTY_RESPONSE",
        model,
      );
      if (valid) {
        playLock();
        if (isDrawerMode) setDrawerProgress(0);
      }
      setChannelData((prev) => ({
        ...prev,
        logs: [
          ...prev.logs,
          {
            role: "SYS",
            text: `MODEL_TEST ${provider.toUpperCase()}/${model}: ${valid ? "VALID_RESPONSE" : "EMPTY_RESPONSE"}`,
          },
        ],
      }));
    } catch (err) {
      setModelHealth(provider, model, "grey");
      pushNetworkEvent(
        provider,
        "Model probe error",
        String(err?.message || err),
      );
      setChannelData((prev) => ({
        ...prev,
        logs: [
          ...prev.logs,
          {
            role: "SYS",
            text: `MODEL_TEST ${provider.toUpperCase()}/${model}: ${String(err?.message || err)}`,
          },
        ],
      }));
    } finally {
      setProbeInFlightByProvider((prev) => {
        if (prev[provider] !== model) return prev;
        return { ...prev, [provider]: "" };
      });
    }
  };

  useEffect(() => {
    if (booted && inputRef.current) inputRef.current.focus();
  }, [booted, chan, server]);
  useEffect(() => {
    if (messageLogRef.current) {
      messageLogRef.current.scrollTo({
        top: messageLogRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [channelData, chan]);

  useEffect(() => {
    if (bootFrame === -1 || booted) return;
    const maxFrames = 4;
    if (bootFrame >= maxFrames) {
      setBooted(true);
      return;
    }
    const timer = setTimeout(() => {
      setBootFrame((p) => p + 1);
    }, 700);
    return () => clearTimeout(timer);
  }, [bootFrame, booted]);

  const getBootArrows = () => {
    const step = bootFrame === -1 ? 0 : Math.min(bootFrame, 3);
    const spaces = " ".repeat((3 - step) * 2);
    const leftPad = " ".repeat(step * 2);
    return `${leftPad}>>${spaces} INITIALIZE UPLINK ${spaces}<<${leftPad}`;
  };

  useEffect(() => {
    const root = document.documentElement;
    const updateViewportHeight = () => {
      const visibleHeight = Math.round(
        window.visualViewport?.height || window.innerHeight,
      );
      root.style.setProperty("--app-height", `${visibleHeight}px`);
    };

    updateViewportHeight();
    window.addEventListener("resize", updateViewportHeight);
    window.addEventListener("orientationchange", updateViewportHeight);
    window.visualViewport?.addEventListener("resize", updateViewportHeight);
    window.visualViewport?.addEventListener("scroll", updateViewportHeight);

    return () => {
      window.removeEventListener("resize", updateViewportHeight);
      window.removeEventListener("orientationchange", updateViewportHeight);
      window.visualViewport?.removeEventListener(
        "resize",
        updateViewportHeight,
      );
      window.visualViewport?.removeEventListener(
        "scroll",
        updateViewportHeight,
      );
    };
  }, []);
  useEffect(() => {
    const updateDrawerMode = () => {
      const matches =
        window.matchMedia?.("(max-width: 980px)")?.matches ?? false;
      setIsDrawerMode(matches);
    };

    updateDrawerMode();
    window.addEventListener("resize", updateDrawerMode);
    window.addEventListener("orientationchange", updateDrawerMode);
    window.visualViewport?.addEventListener("resize", updateDrawerMode);

    return () => {
      window.removeEventListener("resize", updateDrawerMode);
      window.removeEventListener("orientationchange", updateDrawerMode);
      window.visualViewport?.removeEventListener("resize", updateDrawerMode);
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
      if (!booted) return;
      if (!currentKey) {
        setModelFetchStatusByProvider((prev) => ({
          ...prev,
          [activeProvider]: "idle",
        }));
        return;
      }

      setModelFetchStatusByProvider((prev) => ({
        ...prev,
        [activeProvider]: "retrieving",
      }));
      pushNetworkEvent(activeProvider, "CONNECTING", "RETRIEVING_MODELS");
      try {
        const res = await transmit(
          activeProvider,
          "models",
          keys[activeProvider],
        );

        if (!res.ok) {
          setModelFetchStatusByProvider((prev) => ({
            ...prev,
            [activeProvider]:
              res.status === 401 || res.status === 403
                ? "invalid-key"
                : "error",
          }));
          pushNetworkEvent(
            activeProvider,
            res.status === 401 || res.status === 403
              ? "Connection failed"
              : "Uplink error",
            `HTTP ${res.status}`,
          );
          throw new Error(`HTTP_${res.status}`);
        }

        const data = await res.json();
        if (data.data) {
          const sorted = data.data.sort((a, b) => {
            const aFree = a.id.toLowerCase().includes("free");
            const bFree = b.id.toLowerCase().includes("free");
            return aFree === bFree ? 0 : aFree ? -1 : 1;
          });
          const nextList = sorted.slice(0, 50);
          setModelList(nextList);
          setModelFetchStatusByProvider((prev) => ({
            ...prev,
            [activeProvider]: "ready",
          }));
          pushNetworkEvent(
            activeProvider,
            "CONNECTION_SUCCESS",
            `${nextList.length}_MODELS`,
          );
          setModelByProvider((prev) => {
            const current = prev[activeProvider] || "";
            const hasCurrent =
              current && nextList.some((m) => m.id === current);
            const nextModel = hasCurrent ? current : nextList[0]?.id || "";
            if (nextModel === current) return prev;
            localStorage.setItem(`ascii_model_${activeProvider}`, nextModel);
            pushNetworkEvent(activeProvider, "MODEL_SELECTED", nextModel);
            if (nextModel)
              void probeSelectedModel(activeProvider, nextModel, currentKey);
            return { ...prev, [activeProvider]: nextModel };
          });
        }
      } catch (e) {
        setModelList([]);
        const errMsg = String(e?.message || "");
        const isHttpError = /^HTTP_\d+$/.test(errMsg);
        setModelFetchStatusByProvider((prev) => ({
          ...prev,
          [activeProvider]:
            errMsg.includes("HTTP_401") || errMsg.includes("HTTP_403")
              ? "invalid-key"
              : prev[activeProvider] === "invalid-key"
                ? "invalid-key"
                : "error",
        }));
        if (!isHttpError) {
          pushNetworkEvent(
            activeProvider,
            "Network disconnected",
            errMsg || "Check provider or internet",
          );
        }
        console.error("FETCH_ERR", e);
      }
    };
    fetchModels();
  }, [activeProvider, booted, keys]);

  // --- SEND MESSAGE LOGIC ---
  const handleSend = async (e) => {
    if (e.key !== "Enter" || !input.trim()) return;
    playSystemSound("click", 0.15);
    const val = input.trim();
    setInput("");

    if (chan === "providers") {
      const newKeys = { ...keys, [activeProvider]: val };
      setKeys(newKeys);
      setModelList([]);
      setModelFetchStatusByProvider((prev) => ({
        ...prev,
        [activeProvider]: "retrieving",
      }));
      pushNetworkEvent(activeProvider, "KEY_REGISTERED", "CONNECTING");
      localStorage.setItem(`key_${activeProvider}`, val);
      playSystemSound("chirp");
      setChannelData((p) => ({
        ...p,
        logs: [
          ...p.logs,
          {
            role: "SYS",
            text: `KEY FOR ${activeProvider.toUpperCase()} REGISTERED.`,
          },
        ],
      }));
      return;
    }

    setChannelData((prev) => ({
      ...prev,
      [chan]: [...prev[chan], { role: "USER", text: val }],
    }));
    const currentKey = keys[activeProvider];
    const currentModel = modelByProvider[activeProvider] || "";

    if (!currentKey) {
      return setChannelData((prev) => ({
        ...prev,
        [chan]: [...prev[chan], { role: "SYS", text: "ERROR: KEY MISSING" }],
      }));
    }

    if (!currentModel) {
      return setChannelData((prev) => ({
        ...prev,
        [chan]: [
          ...prev[chan],
          {
            role: "SYS",
            text: `ERROR: NO MODEL FOR ${activeProvider.toUpperCase()}`,
          },
        ],
      }));
    }

    const aiId = Date.now();
    setChannelData((prev) => ({
      ...prev,
      [chan]: [...prev[chan], { role: "AI", text: "", id: aiId }],
    }));

    let systemPrompt = "You are MU/TH/UR 6000. Concise, technical.";
    if (chan === "intel")
      systemPrompt = "Science Officer interface. objective data analysis.";
    if (chan === "logs")
      systemPrompt = "Mission Recorder. Chronological log format.";

    let memoryContext = "";
    let memoryContextRows = [];
    try {
      const hits = await Memory.query(val, 3);
      if (hits.length) {
        memoryContextRows = hits;
        memoryContext = [
          "RELEVANT_MEMORY:",
          ...hits.map((hit, idx) => {
            const ts = hit.created_at
              ? new Date(hit.created_at).toLocaleString()
              : "unknown time";
            return `${idx + 1}. [${hit.type}] ${ts} :: ${String(hit.text || "").slice(0, 220)}`;
          }),
        ].join("\n");
      }
      setLastMemoryContext(hits);
    } catch (err) {
      console.warn("MEMORY_QUERY_ERR", err);
      setLastMemoryContext([]);
    }

    try {
      await Memory.add("chat_user", val, {
        provider: activeProvider,
        model: currentModel,
        channel: chan,
        direction: "user",
      });
    } catch (err) {
      console.warn("MEMORY_ADD_USER_ERR", err);
    }

    const promptMessages = [
      {
        role: "system",
        content: `${systemPrompt}\n${memoryContext ? `\n${memoryContext}\n` : "\n"}Use relevant memory as background only.`,
      },
      { role: "user", content: val },
    ];

    try {
      let endpoint = "";
      if (activeProvider === "openai") {
        endpoint = "https://api.openai.com/v1/chat/completions";
      } else if (activeProvider === "opencode") {
        endpoint = "https://opencode.ai/zen/v1/chat/completions"; // FIXED ENDPOINT
      } else {
        endpoint = "https://openrouter.ai/api/v1/chat/completions";
      }

      // NEW MODULAR TRANSMIT
      const res = await transmit(activeProvider, "chat", keys[activeProvider], {
        model: currentModel,
        messages: promptMessages,
        stream: true,
      });

      if (!res.ok) throw new Error(`HTTP_${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullContent = "";
      let streamBuffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        streamBuffer += decoder.decode(value, { stream: true });
        const lines = streamBuffer.split("\n");
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
                fullContent =
                  fullContent.substring(0, 5000) +
                  "\n\n[SYSTEM: BUFFER_OVERFLOW_DETECTION]";
                reader.cancel(); // Physically stops the stream from the server
              }

              // 2. Repetition Filter: Detects if the same character repeats 50+ times (like the smileys)
              const repetitivePattern = /(.)\1{50,}/g;
              if (repetitivePattern.test(fullContent)) {
                fullContent = fullContent.replace(
                  repetitivePattern,
                  "$1... [REPETITIVE_SIGNAL_FILTERED]",
                );
                reader.cancel(); // Stops the AI from wasting more tokens
              }
              // --- SAFETY SHIELD END ---

              playSystemSound("click", 0.05);
              setChannelData((prev) => ({
                ...prev,
                [chan]: prev[chan].map((m) =>
                  m.id === aiId ? { ...m, text: fullContent } : m,
                ),
              }));
            }
          } catch (e) {}
        }
      }

      if (fullContent.trim()) {
        try {
          await Memory.add("chat_ai", fullContent.trim(), {
            provider: activeProvider,
            model: currentModel,
            channel: chan,
            direction: "assistant",
          });
        } catch (err) {
          console.warn("MEMORY_ADD_AI_ERR", err);
        }
      }
    } catch (err) {
      setChannelData((prev) => ({
        ...prev,
        [chan]: [
          ...prev[chan],
          { role: "SYS", text: `UPLINK ERR: ${err.message}` },
        ],
      }));
    }
  };

  const handleLegacyImport = async () => {
    const file = legacyInputRef.current?.files?.[0];
    if (!file) {
      setMigrationStatus("SELECT_A_JSON_FILE_FIRST");
      return;
    }

    setMigrationStatus("IMPORTING...");
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const count = await Memory.importLegacyData(data, { overwrite: false });
      setMigrationStatus(`IMPORTED_${count}_RECORDS`);
      playSystemSound("chirp");
      await loadMemoryPreview();
    } catch (err) {
      setMigrationStatus(`IMPORT_ERR_${err.message}`);
    }
  };

  const handleLegacyPurge = async () => {
    const ok = window.confirm(
      "PURGE imported legacy memories? This removes the SQLite import rows only.",
    );
    if (!ok) return;

    setMigrationStatus("PURGING_LEGACY_ROWS...");
    try {
      const removed = await Memory.purgeLegacyData();
      setMigrationStatus(`PURGED_${removed}_LEGACY_ROWS`);
      playSystemSound("chirp");
      setMemorySearch("");
      setMemorySearchResults([]);
      await loadMemoryPreview();
    } catch (err) {
      setMigrationStatus(`PURGE_ERR_${err.message}`);
    }
  };

  const loadMemoryPreview = async () => {
    setMemoryViewStatus("LOADING...");
    try {
      const [count, recent] = await Promise.all([
        db.memories.count(),
        db.memories.orderBy("created_at").reverse().limit(6).toArray(),
      ]);
      setMemoryCount(count);
      setMemoryPreview(recent);
      setMemoryViewStatus("READY");
    } catch (err) {
      setMemoryViewStatus(`ERROR_${err.message}`);
    }
  };

  const runMemorySearch = async () => {
    const term = memorySearch.trim().toLowerCase();
    if (!term) {
      setMemoryViewStatus("ENTER_A_SEARCH_TERM");
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
    display: "flex",
    flexDirection: "column",
    width: "100%",
    minHeight: "168px",
    aspectRatio: "1 / 1",
    breakInside: "avoid",
    marginBottom: "8px",
    padding: "8px",
    border: "1px solid #1f1f1f",
    borderRadius: "12px",
    background:
      "linear-gradient(180deg, rgba(10,10,10,0.98), rgba(6,6,6,0.98))",
    boxShadow: "0 10px 24px rgba(0, 0, 0, 0.22)",
    overflow: "hidden",
  };
  const widgetTitleStyle = {
    fontSize: "9px",
    letterSpacing: "0.08em",
    marginBottom: "6px",
  };
  const widgetFlowStyle = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
    gap: "7px",
    gridAutoFlow: "dense",
  };
  const summaryTopHit = lastMemoryContext?.[0];
  const memoryCardOrder = ["live", "summary", "tools", "viewer"];
  const moveFullscreenCard = (direction) => {
    if (!memoryFullscreenCard) return;
    const index = memoryCardOrder.indexOf(memoryFullscreenCard);
    if (index < 0) return;
    const nextIndex =
      (index + direction + memoryCardOrder.length) % memoryCardOrder.length;
    setMemoryFullscreenCard(memoryCardOrder[nextIndex]);
  };
  const pulseMomentSnap = (momentId) => {
    if (snapPulseRef.current) {
      window.clearTimeout(snapPulseRef.current);
    }
    setSnappedMomentId(momentId);
    snapPulseRef.current = window.setTimeout(
      () => setSnappedMomentId(null),
      180,
    );
  };
  const findMomentDock = (momentId) => {
    const dockKeys = ["nav", "terminal"];
    return (
      dockKeys.find((dockKey) =>
        (momentDockOrder[dockKey] || []).includes(momentId),
      ) || null
    );
  };
  const moveMomentDockItem = (fromDock, toDock, fromId, toId) => {
    setMomentDockOrder((prev) => {
      const source = Array.isArray(prev[fromDock])
        ? prev[fromDock].slice()
        : [];
      const target =
        fromDock === toDock
          ? source
          : Array.isArray(prev[toDock])
            ? prev[toDock].slice()
            : [];
      const fromIndex = source.indexOf(fromId);
      if (fromIndex < 0) return prev;

      source.splice(fromIndex, 1);

      const targetIndex = toId ? target.indexOf(toId) : -1;
      if (targetIndex >= 0) {
        target.splice(targetIndex, 0, fromId);
      } else {
        target.push(fromId);
      }

      return fromDock === toDock
        ? { ...prev, [fromDock]: target }
        : { ...prev, [fromDock]: source, [toDock]: target };
    });
  };
  const handleMomentDragStart = (event, momentId) => {
    event.stopPropagation();
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", momentId);
    setDraggedMomentId(momentId);
  };
  const handleMomentDragOver = (event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  };
  const handleMomentDrop = (event, momentId, dockKey = "terminal") => {
    event.preventDefault();
    event.stopPropagation();
    const fromId = event.dataTransfer.getData("text/plain") || draggedMomentId;
    const fromDock = fromId ? findMomentDock(fromId) : null;
    if (fromId && fromDock && fromId !== momentId) {
      moveMomentDockItem(fromDock, dockKey, fromId, momentId);
      playSnapLock();
      pulseMomentSnap(momentId);
    } else if (fromId === momentId) {
      playSnapLock();
      pulseMomentSnap(momentId);
    }
    setDraggedMomentId(null);
  };
  const handleMomentDragEnd = (momentId) => {
    setDraggedMomentId(null);
    if (momentId) pulseMomentSnap(momentId);
  };
  const getMomentWidgetStyle = (momentId) => ({
    width: "100%",
    marginBottom: 0,
    cursor: "grab",
    borderRadius: "18px",
    transform:
      draggedMomentId === momentId
        ? "translateY(-7px) scale(1.015)"
        : snappedMomentId === momentId
          ? "translateY(1px) scale(0.99)"
          : "none",
    boxShadow:
      draggedMomentId === momentId
        ? "0 18px 30px rgba(0,0,0,0.32), 0 0 0 1px rgba(155,255,155,0.12) inset"
        : snappedMomentId === momentId
          ? "inset 0 0 0 1px rgba(255,255,255,0.10), 0 6px 14px rgba(0,0,0,0.18)"
          : "none",
    transition:
      "transform 120ms ease, box-shadow 120ms ease, opacity 120ms ease",
    opacity: draggedMomentId && draggedMomentId !== momentId ? 0.94 : 1,
    willChange: draggedMomentId === momentId ? "transform" : "auto",
  });
  const liveMemoryCard = (
    <MemoryMomentCard
      title="LIVE_HANGOUT"
      accent="#9bff9b"
      onFullscreen={() => setMemoryFullscreenCard("live")}
      draggable
      onDragStart={(e) => handleMomentDragStart(e, "live")}
      onDragEnd={() => handleMomentDragEnd("live")}
      onDragOver={handleMomentDragOver}
      onDrop={(e) => handleMomentDrop(e, "live", "terminal")}
      dragged={draggedMomentId === "live"}
      snapped={snappedMomentId === "live"}
    >
      <div>ROWS: {memoryCount}</div>
      <div>TOPK: {lastMemoryContext.length}</div>
      <div>STATE: {memoryViewStatus}</div>
      <div style={{ marginTop: "6px", color: "#78b8ff" }}>
        {summaryTopHit
          ? `#${summaryTopHit.id} ${summaryTopHit.type}`
          : "NO LIVE HITS"}
      </div>
    </MemoryMomentCard>
  );
  const getDockMomentCards = (dockKey) => {
    if (dockKey === "terminal") {
      return {
        live: liveMemoryCard,
        summary: summaryMemoryCard,
        tools: toolsMemoryCard,
        viewer: viewerMemoryCard,
      };
    }
    return {
      live: liveMemoryCard,
    };
  };
  const getDockMomentOrder = (dockKey) =>
    (momentDockOrder[dockKey] || []).filter(
      (id) => getDockMomentCards(dockKey)[id],
    );
  const renderDockMomentTile = (momentId, dockKey) => {
    const dockMomentCards = getDockMomentCards(dockKey);
    return (
      <div
        key={momentId}
        draggable
        onDragStart={(e) => handleMomentDragStart(e, momentId)}
        onDragOver={handleMomentDragOver}
        onDrop={(e) => handleMomentDrop(e, momentId, dockKey)}
        onDragEnd={() => handleMomentDragEnd(momentId)}
        style={getMomentWidgetStyle(momentId)}
      >
        {dockMomentCards[momentId]}
      </div>
    );
  };
  const summaryMemoryCard = (
    <MemoryMomentCard
      title="MEMORY_SUMMARY"
      accent="#78b8ff"
      onFullscreen={() => setMemoryFullscreenCard("summary")}
      draggable
      onDragStart={(e) => handleMomentDragStart(e, "summary")}
      onDragEnd={() => handleMomentDragEnd("summary")}
      onDragOver={handleMomentDragOver}
      onDrop={(e) => handleMomentDrop(e, "summary", "terminal")}
      dragged={draggedMomentId === "summary"}
      snapped={snappedMomentId === "summary"}
    >
      <div>VISIBLE: {memoryPreview.length}</div>
      <div>SEARCH: {memorySearch.trim() ? "ON" : "OFF"}</div>
      <div>STATUS: {memoryViewStatus}</div>
      <div>HITS: {memorySearchResults.length || memoryPreview.length}</div>
    </MemoryMomentCard>
  );
  const toolsMemoryCard = (
    <MemoryMomentCard
      title="MEMORY_TOOLS"
      accent="#ffaa00"
      onFullscreen={() => setMemoryFullscreenCard("tools")}
      draggable
      onDragStart={(e) => handleMomentDragStart(e, "tools")}
      onDragEnd={() => handleMomentDragEnd("tools")}
      onDragOver={handleMomentDragOver}
      onDrop={(e) => handleMomentDrop(e, "tools", "terminal")}
      dragged={draggedMomentId === "tools"}
      snapped={snappedMomentId === "tools"}
      style={{ minWidth: "248px", minHeight: "248px" }}
    >
      <div
        style={{
          display: "grid",
          gap: "6px",
          overflowY: "auto",
          height: "100%",
        }}
      >
        <input
          ref={legacyInputRef}
          type="file"
          accept=".json,application/json"
          onChange={(e) => {
            const file = e.target.files?.[0];
            setSelectedLegacyFileName(file?.name || "");
          }}
          style={{ display: "none" }}
        />
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            minWidth: 0,
          }}
        >
          <button
            type="button"
            onClick={() => legacyInputRef.current?.click()}
            style={{
              flex: "0 0 auto",
              padding: "6px 8px",
              background: "#111",
              color: "#ccc",
              border: "1px solid #333",
              cursor: "pointer",
              fontFamily: "monospace",
              fontSize: "9px",
            }}
          >
            CHOOSE FILE
          </button>
          <div
            title={selectedLegacyFileName || "NO_FILE_SELECTED"}
            style={{
              minWidth: 0,
              flex: 1,
              fontSize: "9px",
              color: "#888",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {selectedLegacyFileName || "NO_FILE_SELECTED"}
          </div>
        </div>
        <button
          type="button"
          onClick={handleLegacyImport}
          style={{
            width: "100%",
            padding: "6px 8px",
            background: "#111",
            color: "#ffaa00",
            border: "1px solid #333",
            cursor: "pointer",
            fontFamily: "monospace",
            fontSize: "9px",
          }}
        >
          IMPORT LEGACY JSON
        </button>
        <button
          type="button"
          onClick={handleLegacyPurge}
          style={{
            width: "100%",
            padding: "6px 8px",
            background: "#1a0909",
            color: "#ff4444",
            border: "1px solid #442222",
            cursor: "pointer",
            fontFamily: "monospace",
            fontSize: "9px",
          }}
        >
          PURGE LEGACY ROWS
        </button>
        <div
          style={{
            marginTop: "2px",
            fontSize: "9px",
            color: "#666",
            wordBreak: "break-word",
          }}
        >
          {migrationStatus || "LOAD memory_for_dexie.json"}
        </div>
      </div>
    </MemoryMomentCard>
  );
  const viewerMemoryCard = (
    <MemoryMomentCard
      title="MEMORY_VIEWER"
      accent="#78b8ff"
      onFullscreen={() => setMemoryFullscreenCard("viewer")}
      draggable
      onDragStart={(e) => handleMomentDragStart(e, "viewer")}
      onDragEnd={() => handleMomentDragEnd("viewer")}
      onDragOver={handleMomentDragOver}
      onDrop={(e) => handleMomentDrop(e, "viewer", "terminal")}
      dragged={draggedMomentId === "viewer"}
      snapped={snappedMomentId === "viewer"}
      style={{ minWidth: "240px", minHeight: "240px" }}
    >
      <button
        type="button"
        onClick={() => void loadMemoryPreview()}
        style={{
          width: "100%",
          padding: "6px 8px",
          background: "#111",
          color: "#78b8ff",
          border: "1px solid #333",
          cursor: "pointer",
          fontFamily: "monospace",
          fontSize: "9px",
          marginBottom: "6px",
        }}
      >
        REFRESH VIEW
      </button>
      <div style={{ marginBottom: "6px", fontSize: "9px", color: "#666" }}>
        {memoryViewStatus} / {memoryCount} RECORDS
      </div>
      <div style={{ display: "flex", gap: "6px" }}>
        <input
          value={memorySearch}
          onChange={(e) => setMemorySearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void runMemorySearch();
          }}
          placeholder="SEARCH memories..."
          style={{
            flex: 1,
            minWidth: 0,
            padding: "6px 8px",
            background: "#0b0b0b",
            color: "#78b8ff",
            border: "1px solid #333",
            fontFamily: "monospace",
            fontSize: "9px",
            outline: "none",
          }}
        />
        <button
          type="button"
          onClick={() => void runMemorySearch()}
          style={{
            padding: "6px 8px",
            background: "#111",
            color: "#78b8ff",
            border: "1px solid #333",
            cursor: "pointer",
            fontFamily: "monospace",
            fontSize: "9px",
          }}
        >
          FIND
        </button>
      </div>
      <div
        style={{
          marginTop: "6px",
          overflowY: "auto",
          flex: 1,
          fontSize: "9px",
          color: "#bbb",
        }}
      >
        {memorySearch.trim() ? (
          memorySearchResults.length === 0 ? (
            <div style={{ color: "#444" }}>NO_SEARCH_MATCHES</div>
          ) : (
            memorySearchResults.slice(0, 3).map((item) => (
              <div
                key={`search-${item.id}`}
                style={{
                  marginBottom: "8px",
                  paddingBottom: "8px",
                  borderBottom: "1px solid #1a1a1a",
                }}
              >
                <div style={{ color: "#78b8ff" }}>
                  #{item.id} {item.type}
                </div>
                <div style={{ color: "#888" }}>
                  {(item.tags || []).slice(0, 4).join(", ") || "-"}
                </div>
              </div>
            ))
          )
        ) : memoryPreview.length === 0 ? (
          <div style={{ color: "#444" }}>NO_MEMORY_ROWS_LOADED</div>
        ) : (
          memoryPreview.slice(0, 3).map((item) => (
            <div
              key={item.id}
              style={{
                marginBottom: "8px",
                paddingBottom: "8px",
                borderBottom: "1px solid #1a1a1a",
              }}
            >
              <div style={{ color: "#00ff00" }}>
                #{item.id} {item.type}
              </div>
              <div style={{ color: "#888" }}>
                {(item.tags || []).slice(0, 4).join(", ") || "-"}
              </div>
            </div>
          ))
        )}
      </div>
    </MemoryMomentCard>
  );
  const momentRailItems = getDockMomentOrder("terminal").map((id) => ({
    id,
    aspectRatio: id === "tools" ? 1.35 : id === "viewer" ? 1.25 : 1,
  }));
  const fullscreenCardStyle = {
    minHeight: "100%",
    height: "100%",
    aspectRatio: "auto",
  };
  const renderFullscreenMemoryCard = () => {
    const fullscreenCards = {
      live: liveMemoryCard,
      summary: summaryMemoryCard,
      tools: toolsMemoryCard,
      viewer: viewerMemoryCard,
    };
    const selected = fullscreenCards[memoryFullscreenCard];
    if (!selected) return null;

    return cloneElement(selected, {
      draggable: false,
      onDragStart: undefined,
      onDragEnd: undefined,
      onDragOver: undefined,
      onDrop: undefined,
      dragged: false,
      snapped: false,
      style: {
        ...(selected.props?.style || {}),
        ...fullscreenCardStyle,
      },
    });
  };
  const memoryPanels = (
    <JustifiedMasonry
      items={momentRailItems}
      targetRowHeight={isDrawerMode ? 104 : 128}
      itemSpacing={8}
      rowSpacing={8}
      getId={(item) => item.id}
      getAspectRatio={(item) => item.aspectRatio}
      renderItem={(item) => renderDockMomentTile(item.id, "terminal")}
    />
  );
  const fullscreenOverlayVisible =
    !!memoryFullscreenCard &&
    ((server === "m" && chan === "intel") ||
      (server === "b" && chan === "samus-manus"));
  const fullscreenOverlayTitle =
    memoryFullscreenCard === "live"
      ? "LIVE_HANGOUT"
      : `MEMORY_${String(memoryFullscreenCard || "").toUpperCase()}`;
  const fullscreenCardContent = renderFullscreenMemoryCard();
  if (!booted) {
    return (
      <>
        <div
          className="boot-screen"
          onClick={() => {
            setupAudio();
            setBooted(true);
          }}
          style={{
            height: "var(--app-height, 100vh)",
            backgroundColor: "#000",
            color: "#00ff00",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            fontFamily: "monospace",
          }}
        >
          <pre
            style={{ textAlign: "center" }}
          >{`[ WAYLAND-YUTANI CYBERDEC ]\n[ MU/TH/UR 6000 ]\n\n${getBootArrows()}`}</pre>
        </div>
      </>
    );
  }

  return (
    <>
      <div
        className="flex h-screen overflow-hidden bg-gray-950 text-green-500 antialiased terminal-window"
        onClick={() => setupAudio()}
        style={{ height: "var(--app-height, 100vh)", fontFamily: "monospace" }}
      >
        {/* COL 1: SERVERS */}
        <aside className="flex flex-col items-center flex-shrink-0 w-16 border-r border-gray-800 bg-gray-900 py-4 z-40 relative">
          {[
            { id: "m", glyph: "Ø" },
            { id: "s", glyph: "μ" },
            { id: "b", glyph: "§" },
          ].map((button) => (
            <div
              key={button.id}
              className="btn-container"
              style={{ width: "56px", height: "52px", position: "relative" }}
            >
              <pre
                className={`ascii-btn${server === button.id ? " is-pushed" : ""}`}
                onClick={() => {
                  if (isDrawerMode) {
                    setDrawerProgress(1);
                  }
                  if (server !== button.id) {
                    setServer(button.id);
                    setChan(defaultChannelByServer[button.id] || "agenda");
                    playSystemSound("chirp");
                  } else {
                    playSystemSound("click", 0.05);
                  }
                }}
                style={{
                  position: "absolute",
                  inset: 0,
                  margin: 0,
                  cursor: "pointer",
                  lineHeight: "1.1",
                  fontSize: "13px",
                }}
              >
                {server === button.id
                  ? art.pushed(button.glyph)
                  : art.popped(button.glyph)}
              </pre>
            </div>
          ))}
        </aside>

        {/* COL 2: NAV */}
        <aside
          ref={navColumnRef}
          className={`flex-col flex-shrink-0 w-64 border-r border-gray-800 bg-gray-900 transition-all duration-300 ${isDrawerMode ? (drawerProgress > 0.5 ? "flex absolute h-full z-30 ml-16 shadow-2xl" : "hidden") : "flex"} overflow-y-auto custom-scrollbar`}
        >
          <div className="p-4 relative">
            {isDrawerMode && (
              <>
                <div
                  onPointerDown={handleDrawerPointerDown}
                  style={{
                    position: "absolute",
                    right: 0,
                    top: "40px",
                    bottom: 0,
                    width: "20px",
                    cursor: "ew-resize",
                    zIndex: 10,
                  }}
                />
              </>
            )}
            <div
              style={{
                color: "#8a8a8a",
                fontSize: "10px",
                marginBottom: "10px",
                letterSpacing: "0.04em",
                paddingRight: "24px",
              }}
            >
              {server === "m"
                ? "ØPERATOR"
                : serverLabelById[server] || "MAINNET-UPLINK"}
            </div>
            {server === "m" ? (
              ["agenda", "intel", "logs"].map((c) => (
                <div
                  key={c}
                  onClick={() => {
                    const isSelected = chan === c;
                    handleRowClick("chan-" + c, isSelected, () => {
                      if (isDrawerMode && isSelected) {
                        setDrawerProgress(0);
                        return;
                      }
                      setChan(c);
                      playSystemSound("click");
                      if (isDrawerMode) setDrawerProgress(0);
                    });
                  }}
                  className={
                    pressedRowId === "chan-" + c ? "nav-row pressed" : "nav-row"
                  }
                  style={{
                    cursor: "pointer",
                    "--nav-color": chan === c ? "#00ff00" : inactiveTextColor,
                    "--nav-shadow":
                      chan === c ? activeTextGlow : inactiveTextGlow,
                    "--nav-hover-color": chan === c ? "#36ff73" : "#b0b0b0",
                    "--nav-hover-shadow":
                      chan === c
                        ? "0 0 10px rgba(54, 255, 115, 0.30)"
                        : inactiveTextGlow,
                    paddingTop: "8px",
                    paddingBottom: "8px",
                  }}
                >
                  {chan === c ? "> " : "# "}
                  {c.toUpperCase()}
                </div>
              ))
            ) : server === "s" ? (
              <>
                <div
                  onClick={() => {
                    setChan("providers");
                    playSystemSound("click");
                    if (isDrawerMode) setDrawerProgress(0);
                  }}
                  className="nav-row"
                  style={{
                    cursor: "pointer",
                    "--nav-color":
                      chan === "providers" ? "#00ff00" : inactiveTextColor,
                    "--nav-shadow":
                      chan === "providers" ? activeTextGlow : inactiveTextGlow,
                    "--nav-hover-color":
                      chan === "providers" ? "#36ff73" : "#b0b0b0",
                    "--nav-hover-shadow":
                      chan === "providers"
                        ? "0 0 10px rgba(54, 255, 115, 0.30)"
                        : inactiveTextGlow,
                    paddingTop: "8px",
                    paddingBottom: "8px",
                  }}
                >
                  # GATEWAY
                </div>
                {providers.map((p) => (
                  <div
                    key={p}
                    onClick={() => {
                      setActiveProvider(p);
                      localStorage.setItem("active_provider", p);
                      playSystemSound("chirp");
                      if (isDrawerMode) setDrawerProgress(0);
                      if (!keys[p]) {
                        setChannelData((prev) => ({
                          ...prev,
                          providers: [
                            ...(prev.providers || []),
                            {
                              role: "SYS",
                              text:
                                p === "openai"
                                  ? "ENTER OPENAI KEY BELOW. create one by visiting Open AI console."
                                  : p === "openrouter"
                                    ? "ENTER OPENROUTER KEY BELOW. create one by visiting OpenRouter console."
                                    : `ENTER ${p.toUpperCase()} KEY BELOW.`,
                            },
                          ],
                        }));
                      }
                    }}
                    className="nav-row"
                    style={{
                      cursor: "pointer",
                      "--nav-color":
                        activeProvider === p
                          ? "#00ff00"
                          : inactiveSubtleTextColor,
                      "--nav-shadow":
                        activeProvider === p
                          ? activeTextGlow
                          : inactiveTextGlow,
                      "--nav-hover-color":
                        activeProvider === p ? "#36ff73" : "#b0b0b0",
                      "--nav-hover-shadow":
                        activeProvider === p
                          ? "0 0 10px rgba(54, 255, 115, 0.30)"
                          : inactiveTextGlow,
                      paddingTop: "5px",
                      paddingBottom: "5px",
                    }}
                  >
                    {activeProvider === p ? "[X] " : "[ ] "}
                    {p.toUpperCase()}
                  </div>
                ))}
                <div
                  style={{
                    marginTop: "20px",
                    borderTop: "1px solid #111",
                    paddingTop: "10px",
                    pointerEvents: probeInFlightByProvider[activeProvider]
                      ? "none"
                      : "auto",
                    opacity: probeInFlightByProvider[activeProvider] ? 0.7 : 1,
                    transition: "opacity 0.2s",
                  }}
                >
                  <div
                    style={{
                      fontSize: "10px",
                      color: inactiveTextColor,
                      textShadow: inactiveTextGlow,
                      marginBottom: "10px",
                    }}
                  >
                    AVAILABLE_MODELS:
                  </div>
                  {!keys[activeProvider] ? null : providerModelFetchStatus ===
                    "retrieving" ? (
                    <div
                      className="model-probe-wave"
                      style={{
                        color: "#ffaa00",
                        textShadow: amberTextGlow,
                        fontSize: "10px",
                      }}
                    >
                      CONNECTING... RETRIEVING_MODELS
                    </div>
                  ) : providerModelFetchStatus === "invalid-key" ? (
                    <div
                      style={{
                        color: "#ff5555",
                        textShadow: "0 0 8px rgba(255, 85, 85, 0.3)",
                        fontSize: "10px",
                      }}
                    >
                      INVALID_KEY // AUTH_REJECTED
                    </div>
                  ) : providerModelFetchStatus === "error" ? (
                    <div
                      style={{
                        color: "#ff7a7a",
                        textShadow: "0 0 8px rgba(255, 122, 122, 0.3)",
                        fontSize: "10px",
                      }}
                    >
                      UPLINK_ERROR // RETRY
                    </div>
                  ) : modelList.length === 0 ? (
                    <div
                      style={{
                        color: inactiveTextColor,
                        textShadow: inactiveTextGlow,
                        fontSize: "10px",
                      }}
                    >
                      NO_MODELS_LOADED
                    </div>
                  ) : (
                    modelList.map((m) => (
                      <div
                        key={m.id}
                        className={
                          probeInFlightByProvider[activeProvider] === m.id
                            ? "model-probe-wave"
                            : "nav-row"
                        }
                        onClick={() => {
                          const prevModel =
                            modelByProvider[activeProvider] || "";
                          setModelByProvider((prev) => ({
                            ...prev,
                            [activeProvider]: m.id,
                          }));
                          localStorage.setItem(
                            `ascii_model_${activeProvider}`,
                            m.id,
                          );
                          pushNetworkEvent(
                            activeProvider,
                            prevModel && prevModel !== m.id
                              ? "MODEL_CHANGED"
                              : "MODEL_SELECTED",
                            m.id,
                          );
                          playSystemSound("click");
                          if (isDrawerMode) setDrawerProgress(0);
                          void probeSelectedModel(
                            activeProvider,
                            m.id,
                            keys[activeProvider],
                          );
                        }}
                        style={{
                          cursor: "pointer",
                          "--nav-color":
                            modelID === m.id
                              ? modelHealthByProvider[activeProvider]?.[
                                  m.id
                                ] === "green"
                                ? "#00ff00"
                                : modelHealthByProvider[activeProvider]?.[
                                      m.id
                                    ] === "amber"
                                  ? "#ffaa00"
                                  : inactiveTextColor
                              : m.id.includes("free")
                                ? "#ffaa00"
                                : inactiveSubtleTextColor,
                          "--nav-shadow":
                            modelID === m.id
                              ? modelHealthByProvider[activeProvider]?.[
                                  m.id
                                ] === "green"
                                ? activeTextGlow
                                : modelHealthByProvider[activeProvider]?.[
                                      m.id
                                    ] === "amber"
                                  ? amberTextGlow
                                  : inactiveTextGlow
                              : m.id.includes("free")
                                ? amberTextGlow
                                : inactiveTextGlow,
                          "--nav-hover-color":
                            modelID === m.id
                              ? modelHealthByProvider[activeProvider]?.[
                                  m.id
                                ] === "green"
                                ? "#36ff73"
                                : "#ffbf4d"
                              : "#b0b0b0",
                          "--nav-hover-shadow":
                            modelID === m.id
                              ? modelHealthByProvider[activeProvider]?.[
                                  m.id
                                ] === "green"
                                ? "0 0 10px rgba(54, 255, 115, 0.30)"
                                : "0 0 10px rgba(255, 191, 77, 0.28)"
                              : inactiveTextGlow,
                          color: "var(--nav-color)",
                          textShadow: "var(--nav-shadow)",
                          fontSize: "10px",
                          paddingTop: "4px",
                          paddingBottom: "4px",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {m.id.split("/").pop()}
                      </div>
                    ))
                  )}
                </div>
              </>
            ) : (
              <>
                <div
                  onClick={() => {
                    const isSelected = chan === "samus-manus";
                    handleRowClick("chan-samus-manus", isSelected, () => {
                      setChan("samus-manus");
                      playSystemSound(isSelected ? "chirp" : "click");
                      if (isDrawerMode) setDrawerProgress(0);
                    });
                  }}
                  className={
                    pressedRowId === "chan-samus-manus"
                      ? "nav-row pressed"
                      : "nav-row"
                  }
                  style={{
                    cursor: "pointer",
                    "--nav-color":
                      chan === "samus-manus" ? "#00ff00" : inactiveTextColor,
                    "--nav-shadow":
                      chan === "samus-manus"
                        ? activeTextGlow
                        : inactiveTextGlow,
                    "--nav-hover-color":
                      chan === "samus-manus" ? "#36ff73" : "#b0b0b0",
                    "--nav-hover-shadow":
                      chan === "samus-manus"
                        ? "0 0 10px rgba(54, 255, 115, 0.30)"
                        : inactiveTextGlow,
                    paddingTop: "8px",
                    paddingBottom: "8px",
                  }}
                >
                  {chan === "samus-manus" ? "> " : "# "}VOICE
                </div>
              </>
            )}
          </div>
        </aside>

        {/* COL 3: TERMINAL */}
        <TerminalColumn
          headerText={`${activeProvider.toUpperCase()} // ${secondColumnSelectionLabel} // ${
            modelID || "NO_MODEL"
          }`}
          headerClassName={
            isActivelyProbing || isRetrievingModels ? "model-probe-wave" : ""
          }
          headerTint={providerTint}
          headerGlow={providerTintGlow}
          onMainClick={() => {
            if (isDrawerMode && drawerProgress > 0.5) {
              setDrawerProgress(0);
            }
          }}
          memoryPanels={server === "m" && chan === "intel" ? memoryPanels : null}
          messages={channelData[chan] || []}
          messageLogRef={messageLogRef}
          chatEndRef={chatEndRef}
          inputRef={inputRef}
          inputValue={input}
          onInputChange={(e) => {
            setInput(e.target.value);
            playSystemSound("click", 0.04);
          }}
          onInputKeyDown={handleSend}
          inputPlaceholder={
            chan === "providers"
              ? "ENTER GATEWAY KEY..."
              : "Enter command or message..."
          }
        />
      </div>

      <MemoryFullscreenOverlay
        open={fullscreenOverlayVisible}
        title={fullscreenOverlayTitle}
        content={fullscreenCardContent}
        onPrevious={() => moveFullscreenCard(-1)}
        onNext={() => moveFullscreenCard(1)}
        onClose={() => setMemoryFullscreenCard(null)}
      />
    </>
  );
}
