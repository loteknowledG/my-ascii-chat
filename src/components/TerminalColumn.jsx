export default function TerminalColumn({
  headerText,
  headerClassName,
  headerTint,
  headerGlow,
  onMainClick,
  topPanel = null,
  memoryPanels = null,
  messages = [],
  messageLogRef,
  chatEndRef,
  inputRef,
  inputValue,
  onInputChange,
  onInputKeyDown,
  inputPlaceholder,
  isAiThinking = false,
}) {
  const renderMessageText = (text) => {
    if (
      typeof text === "string" &&
      (text.includes("Open AI console") || text.includes("OpenRouter console"))
    ) {
      return (
        <span>
          {text.split(/(Open AI console|OpenRouter console)/g).map((part, idx) => {
            if (part === "Open AI console") {
              return (
                <a
                  key={idx}
                  href="https://platform.openai.com/settings/api-keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    color: "#78b8ff",
                    textDecoration: "underline",
                  }}
                >
                  {part}
                </a>
              );
            }
            if (part === "OpenRouter console") {
              return (
                <a
                  key={idx}
                  href="https://openrouter.ai/workspaces/default/keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    color: "#78b8ff",
                    textDecoration: "underline",
                  }}
                >
                  {part}
                </a>
              );
            }
            return part;
          })}
        </span>
      );
    }

    return text;
  };

  return (
    <main
      className="flex flex-col flex-1 min-w-0 bg-black"
      onClick={onMainClick}
    >
      <header className="flex items-center h-16 px-6 border-b border-gray-800 bg-gray-900/50 backdrop-blur-md">
        <div
          className={headerClassName || ""}
          style={{
            color: headerTint,
            textShadow: headerGlow,
            fontSize: "10px",
          }}
        >
          {headerText}
        </div>
      </header>

      {topPanel ? (
        <div className="flex-shrink-0 px-4 pt-2 pb-1" style={{ overflow: "visible" }}>
          {topPanel}
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pb-4 pt-2 custom-scrollbar">
        {memoryPanels ? (
          <div style={{ marginBottom: "16px" }}>{memoryPanels}</div>
        ) : null}

        <div
          ref={messageLogRef}
          className="message-log"
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: "auto",
            marginBottom: "20px",
          }}
        >
          {messages.map((m, i) => (
            <div key={i} style={{ marginBottom: "15px" }}>
              <span
                style={{
                  color:
                    m.role === "AI"
                      ? "#00ff00"
                      : m.role === "SYS"
                        ? "#ffaa00"
                        : "#444",
                }}
              >
                [{m.role}]
              </span>{" "}
              <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", margin: 0, display: "inline" }}>
                {renderMessageText(m.text)}
              </pre>
            </div>
          ))}

          <div ref={chatEndRef} />
          {isAiThinking && (
            <div style={{ color: "#00ff00", fontSize: "12px", marginTop: "8px" }}>
              <span className="cursor-blink">█</span> COGITATING...
            </div>
          )}
        </div>
      </div>

      <footer className="p-4 bg-gray-900/80 border-t border-gray-800">
        <div className="relative flex items-center">
          <span className="absolute left-4 text-green-500 font-bold text-lg">
            $
          </span>
          <input
            ref={inputRef}
            value={inputValue}
            onChange={onInputChange}
            onKeyDown={onInputKeyDown}
            placeholder={inputPlaceholder}
            className="w-full bg-black border border-gray-700 rounded-lg py-3 pl-10 pr-4 focus:outline-none focus:border-green-500 text-green-400 placeholder-gray-700 transition-all font-mono text-sm"
          />
        </div>
      </footer>
    </main>
  );
}
