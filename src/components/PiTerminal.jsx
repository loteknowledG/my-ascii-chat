import React, { useState, useEffect, useRef, useCallback } from "react";

const PiSession = ({ onExit }) => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [streamText, setStreamText] = useState("");
  const [status, setStatus] = useState("idle");
  const [currentTool, setCurrentTool] = useState(null);
  const [toolOutput, setToolOutput] = useState("");
  const [modelInfo, setModelInfo] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [pendingQueue, setPendingQueue] = useState({ steering: [], followUp: [] });
  const procRef = useRef(null);
  const decoderRef = useRef(null);
  const bufferRef = useRef("");
  const streamTextRef = useRef("");
  const inputRef = useRef(null);
  const messageLogRef = useRef(null);
  const pendingResponseRef = useRef(null);

  const appendMessage = useCallback((role, text, type = "text") => {
    setMessages((prev) => [...prev, { role, text, type, id: Date.now() + Math.random() }]);
  }, []);

  const sendCommand = useCallback((cmd) => {
    if (procRef.current && procRef.current.stdin) {
      procRef.current.stdin.write(JSON.stringify(cmd) + "\n");
    }
  }, []);

  useEffect(() => {
    const startPi = async () => {
      setStatus("starting");

      try {
        const { spawn } = await import("child_process");
        const proc = spawn("pi", ["--mode", "rpc", "--no-session"], {
          stdio: ["pipe", "pipe", "pipe"],
          shell: true,
        });
        procRef.current = proc;

        proc.stderr?.once("data", (data) => {
          const text = data.toString();
          if (text.includes("pi:")) return;
          appendMessage("SYS", text.slice(0, 200), "error");
        });

        proc.on("error", (err) => {
          setStatus("error");
          appendMessage("SYS", `LAUNCH_ERR: ${err.message}`, "error");
        });

        proc.on("exit", (code) => {
          setStatus("exited");
          appendMessage("SYS", `PI_EXIT: code=${code}`, "system");
          if (onExit) onExit();
        });

        const decoder = new (await import("string_decoder")).StringDecoder("utf8");
        decoderRef.current = decoder;

        proc.stdout.on("data", (chunk) => {
          bufferRef.current += decoder.write(chunk);
          const lines = bufferRef.current.split("\n");
          bufferRef.current = lines.pop() || "";

          for (const rawLine of lines) {
            let line = rawLine.trim();
            if (!line) continue;
            if (line.endsWith("\r")) line = line.slice(0, -1);
            if (!line.startsWith("{")) continue;

            try {
              const event = JSON.parse(line);
              handleEvent(event);
            } catch (e) {
              console.warn("PI_PARSE_ERR", e.message, line.slice(0, 80));
            }
          }
        });

        setStatus("ready");
        sendCommand({ type: "get_state" });
        sendCommand({ type: "get_available_models" });

        setStatus("ready");
        sendCommand({ type: "get_state" });
      } catch (err) {
        setStatus("error");
        appendMessage("SYS", `IMPORT_ERR: ${err.message}`, "error");
      }
    };

    startPi();

    return () => {
      if (procRef.current) {
        procRef.current.kill("SIGTERM");
      }
    };
  }, []);

  const handleEvent = useCallback((event) => {
    switch (event.type) {
      case "agent_start":
        setStatus("thinking");
        setStreamText("");
        streamTextRef.current = "";
        break;

      case "message_update": {
        const delta = event.assistantMessageEvent;
        if (delta?.type === "text_delta") {
          streamTextRef.current += delta.delta;
          setStreamText(streamTextRef.current);
        } else if (delta?.type === "toolcall_start") {
          setCurrentTool(delta.toolName || "tool");
          setToolOutput("");
        } else if (delta?.type === "toolcall_delta") {
          setToolOutput((prev) => prev + (delta.delta || ""));
        }
        break;
      }

      case "tool_execution_start":
        setCurrentTool(event.toolName);
        setToolOutput("");
        break;

      case "tool_execution_update":
        if (event.partialResult?.content) {
          const text = event.partialResult.content
            .map((c) => (c.type === "text" ? c.text : ""))
            .join("");
          setToolOutput(text);
        }
        break;

      case "tool_execution_end":
        setCurrentTool(null);
        if (event.result?.content) {
          const text = event.result.content
            .map((c) => (c.type === "text" ? c.text : ""))
            .join("");
          if (event.isError && text.toLowerCase().includes("image") && text.toLowerCase().includes("does not support")) {
            setErrorMsg("IMAGE_INPUT_ERR: This model does not support image input.");
          }
          appendMessage("tool", text, "result");
        }
        setToolOutput("");
        break;

      case "message_end":
        if (streamTextRef.current) {
          appendMessage("assistant", streamTextRef.current, "text");
          streamTextRef.current = "";
          setStreamText("");
        }
        break;

      case "agent_end":
        setStatus("ready");
        break;

      case "queue_update":
        setPendingQueue({
          steering: event.steering || [],
          followUp: event.followUp || [],
        });
        break;

      case "extension_ui_request": {
        const { id, method, title, options, message, placeholder, prefill, timeout } = event;
        pendingResponseRef.current = { id, method };
        handleExtensionUIRequest({ id, method, title, options, message, placeholder, prefill, timeout });
        break;
      }

      case "response": {
        const model = event.data?.model;
        if (model) {
          setModelInfo(model);
          appendMessage("SYS", `MODEL: ${model.id}`, "system");
        }
        if (event.command === "get_state") {
          if (event.data?.model) {
            setModelInfo(event.data.model);
          }
          appendMessage("SYS", `STATE: ${event.data?.isStreaming ? "STREAMING" : "IDLE"}`, "system");
        } else if (event.command === "set_model" && model) {
          setModelInfo(model);
          appendMessage("SYS", `SWITCHED: ${model.id}`, "system");
        } else if (event.command === "get_available_models") {
          const models = event.data?.models || [];
          if (models.length > 0) {
            appendMessage("SYS", `MODELS: ${models.map(m => m.id).join(", ").slice(0, 200)}`, "system");
          }
        }
        break;
      }
    }
  }, [appendMessage]);

  const handleExtensionUIRequest = useCallback(({ id, method, title, options, message, placeholder, prefill, timeout }) => {
    if (method === "notify" || method === "setStatus" || method === "setWidget" || method === "setTitle" || method === "set_editor_text") {
      sendCommand({ type: "extension_ui_response", id, cancelled: true });
      return;
    }

    if (method === "select" && options?.length) {
      const selected = options[0];
      sendCommand({ type: "extension_ui_response", id, value: selected });
    } else if (method === "confirm") {
      sendCommand({ type: "extension_ui_response", id, confirmed: true });
    } else if (method === "input") {
      sendCommand({ type: "extension_ui_response", id, value: placeholder || "" });
    } else if (method === "editor") {
      sendCommand({ type: "extension_ui_response", id, value: prefill || "" });
    } else {
      sendCommand({ type: "extension_ui_response", id, cancelled: true });
    }
  }, [sendCommand]);

  const handleSend = (e) => {
    if (e.key !== "Enter" || !input.trim()) return;
    const text = input.trim();
    setInput("");

    if (status === "thinking") {
      sendCommand({ type: "prompt", message: text, streamingBehavior: "steer" });
    } else {
      sendCommand({ type: "prompt", message: text });
    }
  };

  const handleAbort = () => {
    sendCommand({ type: "abort" });
    setStatus("ready");
  };

  const handleNewSession = () => {
    sendCommand({ type: "new_session" });
    setMessages([]);
    setStreamText("");
    streamTextRef.current = "";
  };

  useEffect(() => {
    if (messageLogRef.current) {
      messageLogRef.current.scrollTop = messageLogRef.current.scrollHeight;
    }
  }, [messages, streamText]);

  const statusColor = status === "ready" ? "#00ff00" : status === "thinking" ? "#ffaa00" : status === "error" ? "#ff5555" : "#888888";
  const statusLabel = status === "idle" ? "PI_INIT" : status === "starting" ? "LAUNCHING" : status === "ready" ? "READY" : status === "thinking" ? "RUNNING" : status === "exited" ? "EXITED" : "ERR";

  const displayModel = modelInfo?.id || (status === "ready" ? "CONNECTED" : null);

  return (
    <div className="flex flex-col h-full bg-black text-green-400 font-mono text-xs">
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-800 bg-gray-950">
        <div className="flex items-center gap-3">
          <span style={{ color: statusColor }}>●</span>
          <span style={{ color: statusColor }}>PI_TERMINAL</span>
          <span style={{ color: statusColor }}>{statusLabel}</span>
          {displayModel && (
            <span style={{ color: "#00ff00", textShadow: "0 0 6px rgba(0, 255, 0, 0.3)" }}>
              {displayModel}
            </span>
          )}
          {currentTool && (
            <span style={{ color: "#78b8ff" }}>TOOL:{currentTool}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {pendingQueue.steering.length > 0 && (
            <span style={{ color: "#ffaa00" }}>STEER:{pendingQueue.steering.length}</span>
          )}
          {pendingQueue.followUp.length > 0 && (
            <span style={{ color: "#9bff9b" }}>FOLLOW:{pendingQueue.followUp.length}</span>
          )}
          <button
            onClick={handleNewSession}
            className="px-2 py-1 bg-gray-800 text-gray-400 border border-gray-700 rounded hover:bg-gray-700"
            style={{ fontSize: "9px" }}
          >
            NEW
          </button>
          <button
            onClick={handleAbort}
            className="px-2 py-1 bg-gray-800 text-red-400 border border-gray-700 rounded hover:bg-gray-700"
            style={{ fontSize: "9px" }}
          >
            ABORT
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="px-3 py-2 bg-red-950 border-b border-red-800 text-red-400 text-xs font-mono">
          {errorMsg}
        </div>
      )}

      <div ref={messageLogRef} className="flex-1 overflow-y-auto p-3 space-y-2">
        {messages.map((msg) => (
          <div key={msg.id} className="flex flex-col gap-1">
            <div className="flex items-start gap-2">
              <span className="text-gray-600 w-12 flex-shrink-0">
                {msg.role === "assistant" ? "AI" : msg.role === "tool" ? "TOOL" : msg.role === "SYS" ? "SYS" : "USER"}
              </span>
              <span className={msg.role === "tool" ? "text-cyan-400" : msg.role === "assistant" ? "text-green-300" : msg.role === "SYS" ? "text-yellow-600" : "text-gray-300"}>
                {msg.text}
              </span>
            </div>
          </div>
        ))}
        {streamText && (
          <div className="flex items-start gap-2">
            <span className="text-gray-600 w-12 flex-shrink-0">AI</span>
            <span className="text-green-300">{streamText}</span>
            <span className="cursor-blink text-green-500">█</span>
          </div>
        )}
        {toolOutput && (
          <div className="flex items-start gap-2 ml-4 border-l border-gray-700 pl-2">
            <span className="text-gray-600 w-10 flex-shrink-0">OUT</span>
            <span className="text-cyan-400 text-xs">{toolOutput.slice(-500)}</span>
          </div>
        )}
      </div>

      <div className="p-2 border-t border-gray-800 bg-gray-950">
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleSend}
          placeholder="pi > message..."
          className="w-full px-3 py-2 bg-black border border-gray-700 text-green-400 placeholder-gray-600 focus:outline-none focus:border-green-500"
          style={{ fontFamily: "monospace", fontSize: "11px" }}
        />
      </div>
    </div>
  );
};

export default PiSession;