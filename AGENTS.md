# Wayland-Yutani Cyberdec

This repo is the product shell and UI layer.

The canonical harness and memory rules live in the sibling repo:

- `..\cognosys\AGENTS.md`
- `..\cognosys\docs\COGNOSYS_MEMORY_ARCHITECTURE.md`
- `..\cognosys\docs\RUNTIMES.md`

## Read Order

1. `AGENTS.md`
2. `README.md`
3. `docs/HARNESS_CONTEXT.md`
4. `docs/WAYLAND_YUTANI_MEMORY_ARCHITECTURE.md`

## Working Rules

- Keep UI changes aligned with the harness docs.
- Treat the sibling harness repo as the source of truth for memory and workflow.
- Route execution concerns to the harness instead of embedding runtime policy here.
- Keep product state visible and inspectable.
- Update docs whenever the app behavior changes.

## Intent

This repo is the shell. The harness is where the context contract lives.

## Pi Integration

The cyberdeck embeds [pi](https://pi.dev/) as a terminal coding agent via its RPC mode. When server `p` (π) is selected:

- pi launches as a subprocess with `pi --mode rpc --no-session`
- The `PiTerminal` component (`src/components/PiTerminal.jsx`) manages stdin/stdout JSONL
- Extension UI requests (select, confirm, input, editor) are handled with sensible defaults
- pi has access to the cyberdeck's memory system via bash commands and can route through the uplink

Pi brings:
- Tree-structured session history with fork/clone
- 15+ model providers (Anthropic, OpenAI, Google, Groq, Cerebras, etc.)
- Skills and prompt templates loaded on-demand
- Extensions architecture (sub-agents, plan mode, permission gates, MCP integration)
