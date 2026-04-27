import React, { useState, useEffect, useRef, useCallback } from "react";

const PiSession = ({ onExit }) => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [streamText, setStreamText] = useState("");
  const [status, setStatus] = useState("idle");
  const [currentTool, setCurrentTool] = useState(null);
  const [toolOutput, setToolOutput] = useState("");
  const [modelInfo, setModelInfo] = useState(null);
  const [error, setError] = useState(null);
  const [connected, setConnected] = useState(false);
  const streamTextRef = useRef("");
  const messageLogRef = useRef(null);
  const cleanupRef = useRef(null);

  const appendMessage = useCallback((role, text, type = "text") => {
    setMessages((prev) => [...prev, { role, text, type, id: Date.now() + Math.random() }]);
  }, []);

  const handlePiOutput = useCallback((data) => {
    console.log('[PI_RENDERER] Received:', JSON.stringify(data));
    switch (data.type) {
      case "output":
        setStreamText((prev) => prev + data.text);
        streamTextRef.current += data.text;
        break;
      case "tool_call":
        setCurrentTool(data.name);
        appendMessage("TOOL", `${data.name}(${JSON.stringify(data.args)})`, "tool_call");
        break;
      case "tool_result":
        setCurrentTool(null);
        setToolOutput(data.result || "");
        appendMessage("TOOL", data.result || "(empty)", "tool_result");
        break;
      case "model":
        setModelInfo(data);
        break;
      case "error":
        setError(data.text);
        setStatus("error");
        appendMessage("SYS", `ERROR: ${data.text}`, "error");
        break;
      case "done":
        if (streamTextRef.current) {
          appendMessage("assistant", streamTextRef.current, "text");
          streamTextRef.current = "";
          setStreamText("");
        }
        setStatus("ready");
        break;
      case "exit":
        setConnected(false);
        setStatus("exited");
        appendMessage("SYS", "PI terminated", "system");
        break;
      case "stderr":
        appendMessage("SYS", data.text, "error");
        break;
      default:
        break;
    }
  }, [appendMessage]);

  useEffect(() => {
    if (!window.electronAPI) {
      setStatus("no-electron");
      setError("Not running in Electron. PI tab requires Electron app.");
      return;
    }

    setStatus("starting");
    window.electronAPI.piSpawn().then((result) => {
      if (result.success) {
        setConnected(true);
        setStatus("ready");
        appendMessage("SYS", "PI_TERMINAL: Connected. Ready.", "system");
        cleanupRef.current = window.electronAPI.piOnOutput(handlePiOutput);
      } else {
        setStatus("error");
        setError(result.error || "Failed to spawn PI");
        appendMessage("SYS", `PI_SPAWN_ERR: ${result.error}`, "error");
      }
    });

    return () => {
      if (cleanupRef.current) cleanupRef.current();
    };
  }, [handlePiOutput, appendMessage]);

  const handleSend = (e) => {
    console.log('[PI_RENDERER] handleSend called, key:', e.key, 'input:', input);
    if (e.key !== "Enter" || !input.trim()) return;
    if (!connected) return;

    const text = input.trim();
    console.log('[PI_RENDERER] Sending to PI:', text);
    setInput("");
    appendMessage("user", text, "text");
    setStreamText("");
    streamTextRef.current = "";
    setStatus("thinking");
    setError(null);

    window.electronAPI.piSend({ type: "prompt", text });
  };

  const handleAbort = () => {
    if (!connected) return;
    window.electronAPI.piAbort();
    setStatus("ready");
    setStreamText("");
    streamTextRef.current = "";
  };

  const handleNewSession = () => {
    if (!connected) return;
    window.electronAPI.piSend({ type: "new_session" });
    setMessages([]);
    setStreamText("");
    streamTextRef.current = "";
    setToolOutput("");
  };

  useEffect(() => {
    if (messageLogRef.current) {
      messageLogRef.current.scrollTop = messageLogRef.current.scrollHeight;
    }
  }, [messages, streamText, toolOutput]);

  if (status === "no-electron") {
    return (
      <div className="flex flex-col h-full bg-black text-red-400 font-mono text-xs p-4">
        <div className="text-red-500 mb-2">● NOT_CONNECTED</div>
        <div>PI requires Electron app. Use npm run dev:full</div>
        <div className="mt-2 text-gray-500">Main process: PI subprocess running in terminal window.</div>
      </div>
    );
  }

  const statusColor = status === "ready" ? "#00ff00" : status === "thinking" ? "#ffaa00" : status === "error" ? "#ff5555" : "#888888";
  const statusLabel = status === "idle" ? "PI_INIT" : status === "starting" ? "LAUNCHING" : status === "ready" ? "READY" : status === "thinking" ? "RUNNING" : status === "exited" ? "EXITED" : "ERR";

  return (
    <div className="flex flex-col h-full bg-black text-green-400 font-mono text-xs">
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-800 bg-gray-950">
        <div className="flex items-center gap-3">
          <span style={{ color: statusColor }}>●</span>
          <span style={{ color: statusColor }}>PI_TERMINAL</span>
          <span style={{ color: statusColor }}>{statusLabel}</span>
          {modelInfo?.id && (
            <span style={{ color: "#00ff00", textShadow: "0 0 6px rgba(0, 255, 0, 0.3)" }}>
              {modelInfo.id}
            </span>
          )}
          {currentTool && (
            <span style={{ color: "#78b8ff" }}>TOOL:{currentTool}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleNewSession}
            disabled={!connected}
            className="px-2 py-1 bg-gray-800 text-gray-400 border border-gray-700 rounded hover:bg-gray-700 disabled:opacity-50"
            style={{ fontSize: "9px" }}
          >
            NEW
          </button>
          <button
            onClick={handleAbort}
            disabled={!connected || status !== "thinking"}
            className="px-2 py-1 bg-gray-800 text-red-400 border border-gray-700 rounded hover:bg-gray-700 disabled:opacity-50"
            style={{ fontSize: "9px" }}
          >
            ABORT
          </button>
        </div>
      </div>

      <div ref={messageLogRef} className="flex-1 overflow-y-auto p-3 space-y-2">
        {messages.map((msg) => (
          <div key={msg.id} className="flex flex-col gap-1">
            <div className="flex items-start gap-2">
              <span className="text-gray-600 w-12 flex-shrink-0">
                {msg.role === "assistant" ? "AI" : msg.role === "tool" ? "TOOL" : msg.role === "TOOL" ? "TOOL" : msg.role === "SYS" ? "SYS" : "USER"}
              </span>
              <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", margin: 0 }}>{msg.text}</pre>
            </div>
          </div>
        ))}
        {streamText && (
          <div className="flex items-start gap-2">
            <span className="text-gray-600 w-12 flex-shrink-0">AI</span>
            <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", margin: 0, color: "#aaffaa" }}>{streamText}</pre>
            <span className="cursor-blink text-green-500">█</span>
          </div>
        )}
        {toolOutput && (
          <div className="flex items-start gap-2 ml-4 border-l border-gray-700 pl-2">
            <span className="text-gray-600 w-10 flex-shrink-0">OUT</span>
            <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", margin: 0, color: "#00d4ff", fontSize: "11px" }}>{toolOutput.slice(-500)}</pre>
          </div>
        )}
        {error && (
          <div className="text-red-500 mt-2">ERROR: {error}</div>
        )}
      </div>

      <div className="p-2 border-t border-gray-800 bg-gray-950">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleSend}
          placeholder={connected ? "pi > message..." : "PI not connected..."}
          disabled={!connected}
          className="w-full px-3 py-2 bg-black border border-gray-700 text-green-400 placeholder-gray-600 focus:outline-none focus:border-green-500 disabled:opacity-50"
          style={{ fontFamily: "monospace", fontSize: "11px" }}
        />
      </div>
    </div>
  );
};

export default PiSession;