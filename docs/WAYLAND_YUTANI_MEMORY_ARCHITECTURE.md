# Wayland-Yutani Cyberdec Memory Architecture

This is the memory and retrieval shape Wayland-Yutani Cyberdec should follow.

## Core Principles

- Use layered memory, not one giant blob.
- Keep a lightweight index that points to the right data.
- Only write memory after successful actions.
- Separate memory by purpose and retention.
- Preserve raw records when something matters.
- Compact only after the raw record is safely kept.
- Make memory visible in the UI.
- Treat the file system as semantic: files and nodes should be linked by meaning, not just path.

## Memory Types

- `hangout`: short-term vibe, inside jokes, temporary context.
- `project`: mounted work context for a specific task or repo.
- `long-term`: durable identity, preferences, and learned skills.
- `remember`: pinned raw record that should not roll off.
- `skill`: reusable method extracted from experience.
- `persona`: stable preference or behavior pattern.

## Memory Actions

- `remember` means pin now.
- `classify` means assign meaning and type.
- `promote` means copy into durable memory.
- `forget` means unload or prune the active layer.
- `brief` means load the current project context.
- `work` means operate inside the mounted memory.
- `debrief` means capture the lesson and save it back.
- `unload` means stop carrying that project forward.

## Retrieval Loop

1. Retrieve top-k relevant memories.
2. Inject them into the prompt.
3. Do the work.
4. Save a compact lesson back.
5. Keep the original record if it matters.
6. Promote only what survives.

## UI Shape

- Show memory hits in the interface.
- Show the injected prompt block.
- Show the retrospective preview.
- Let widgets/cards move between grids and docks.
- Keep live/session cards out of fullscreen rotation if they are pinned widgets.

## What to Avoid

- One giant append-only pile with no pruning.
- Writing every noisy attempt as durable memory.
- Destroying raw context when compaction happens.
- Hiding memory from the user.

## Goal

A memory system that behaves like a semantic file system:

- index
- retrieve
- inject
- act
- save lessons
- keep raw truth
- promote only what survives

