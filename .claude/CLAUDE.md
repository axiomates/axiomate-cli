# CLAUDE.md

This file provides guidance for Claude Code when working with this repository.

## Maintenance Rule

**IMPORTANT**: After making code changes, Claude Code should update this file to reflect any architectural changes, new features, modified commands, or updated file structures. Keep this document accurate and concise.

## Project Overview

axiomate is a terminal-based AI agent application built with React 19 + Ink 6. It provides an interactive CLI interface with autocomplete, hierarchical slash commands, multi-file selection, and structured input handling.

## Tech Stack

- **React 19** + **Ink 6** - Terminal UI framework
- **TypeScript 5.7** - Language
- **Node.js >= 20** - Runtime
- **Vitest** - Testing
- **marked** + **marked-terminal** - Markdown rendering
- **@modelcontextprotocol/sdk** - MCP Server integration

## Build & Run Commands

```bash
npm run build      # Compile TypeScript
npm run dev        # Watch mode
npm start          # Run CLI
npm test           # Run tests
npm run lint:fix   # Auto-fix lint issues
npm run package    # Build standalone executable (requires Bun)
```

## Project Structure

```
source/
├── cli.tsx                    # Entry point
├── app.tsx                    # Main app component
├── components/
│   ├── AutocompleteInput/     # Core input component
│   │   ├── index.tsx          # Main component
│   │   ├── types.ts           # EditorState, UIMode, EditorAction
│   │   ├── reducer.ts         # State machine reducer
│   │   ├── hooks/             # useAutocomplete, useInputHandler, useFileSelect
│   │   └── components/        # InputLine, SlashMenu, FileMenu, HelpPanel
│   ├── MessageOutput.tsx      # Message display (Markdown, scrolling, collapse)
│   ├── Splash.tsx             # Startup splash screen
│   └── Welcome.tsx            # First-time user setup
├── models/
│   ├── input.ts               # UserInput types
│   ├── inputInstance.ts       # InputInstance - core input data model
│   └── messageGroup.ts        # Message grouping and collapse
├── constants/
│   ├── commands.ts            # Slash command tree (dynamic generation)
│   ├── models.ts              # DEFAULT_MODEL_ID, DEFAULT_SUGGESTION_MODEL_ID
│   └── colors.ts              # Color constants
├── services/
│   ├── commandHandler.ts      # Command execution and routing
│   ├── ai/                    # AI service (session, streaming, tools)
│   │   ├── service.ts         # AIService main class
│   │   ├── session.ts         # Session with token tracking
│   │   ├── sessionStore.ts    # Multi-session persistence
│   │   ├── messageQueue.ts    # Sequential message processing
│   │   └── clients/           # OpenAI/Anthropic API clients
│   └── tools/                 # Local development tools discovery
│       ├── registry.ts        # ToolRegistry singleton
│       └── discoverers/       # Per-tool discovery modules
├── i18n/                      # Internationalization (en, zh-CN, ja)
└── utils/
    ├── config.ts              # User config (~/.axiomate.json)
    └── logger.ts              # Async logging with rotation
```

## Slash Commands

Commands are defined in `constants/commands.ts` with dynamic generation:

```
/model [current]           - Switch AI model (dynamically generated from config)
/thinking [on|off]         - Toggle AI thinking mode
/session                   - Session management
  /list                    - List all sessions
  /new                     - Create new session
  /switch <name>           - Switch to session (by name, shows ID in description)
  /delete <name>           - Delete session (by name)
  /clear                   - Clear current session
/compact                   - Summarize and compress context
/stop                      - Stop current AI processing
/tools [list|refresh|stats] - Tool management
/suggestion [on|off]       - Toggle AI suggestions
  /model [current]         - Select suggestion model (shows current in description)
/language [en|zh-CN|ja]    - Switch interface language
/exit                      - Exit application
```

**Dynamic Command Features**:
- Model commands show current selection with `▶` prefix
- `/model` description shows `[ModelName]` suffix
- `/suggestion model` description shows `[ModelName]` suffix
- Session switch/delete use session name as command name, ID in description

**Adding a new command**:
1. Add to `getSlashCommands()` in `constants/commands.ts`
2. Add handler in `services/commandHandler.ts` `internalHandlers`
3. Call `clearCommandCache()` if command state changes dynamically

## Configuration

**User config** (`~/.axiomate.json`):
```typescript
{
  models: Record<string, ModelConfig>;  // Per-model API configs
  currentModel: string;                 // Current model ID
  suggestionModel: string;              // Suggestion model ID
  suggestionEnabled?: boolean;          // Default: true
  thinkingEnabled?: boolean;            // Default: false
}
```

**Default constants** (`constants/models.ts`):
- `DEFAULT_MODEL_ID = "Qwen/Qwen3-8B"`
- `DEFAULT_SUGGESTION_MODEL_ID = "THUDM/glm-4-9b-chat"`

## Key Architecture Patterns

### Data-Driven Input System

`InputInstance` is the **single source of truth** for all input state:
- All operations update `InputInstance` first, then render from it
- History stores `HistoryEntry` (InputInstance without cursor)
- File selections track positions for atomic block operations

### UI Modes

| Mode      | Trigger | Description                     |
|-----------|---------|--------------------------------|
| `normal`  | default | Regular input with autocomplete |
| `history` | ↑/↓     | Browse command history          |
| `slash`   | `/`     | Navigate hierarchical commands  |
| `file`    | `@`     | Navigate file system            |
| `help`    | `?`     | Display shortcuts overlay       |

### Focus Modes

| Mode   | Toggle      | ↑/↓ Behavior      |
|--------|-------------|-------------------|
| Input  | `Shift+↑/↓` | History navigation |
| Browse | `Shift+↑/↓` | Scroll messages    |

### Message Collapsing

- Messages grouped into Q&A pairs
- Auto-collapse old groups when new arrives
- Browse mode: `Enter` to toggle, `e` expand all, `c` collapse all
- Uses `▶` (collapsed) and `▼` (expanded) indicators

### Session Management

- `SessionStore` manages multiple sessions with persistence
- `/session list` displays sessions with `▶` for active, `○` for inactive
- Session switch/delete commands use **session name** (not ID) as identifier
- Auto-compact at 85% context usage

## AI Service

### Streaming

- Real-time SSE streaming with Braille spinner animation
- Supports `reasoning_content` for thinking models
- Tool calls accumulated during stream, executed on `finish_reason: "tool_calls"`

### Tool Selection

Uses local directory analysis (not AI two-phase):
- Detects project type from marker files (package.json, requirements.txt, etc.)
- Infers from @selected file extensions
- Saves tokens and reduces latency

## Internationalization

- System locale auto-detection
- Instant language switching via listener pattern
- Commands: `/language en|zh-CN|ja`
- Translation files in `source/i18n/locales/`

## Code Conventions

- Use `useMemo` for derived values, `useCallback` for handlers
- Types in `models/`, `.d.ts` in `types/`
- Chinese comments acceptable
- Use `PATH_SEPARATOR` from `constants/platform.ts`
- Markdown rendering may strip leading spaces - use visible markers (like `○`) instead

## Common Tasks

### Adding a Tool Discoverer

1. Create file in `services/tools/discoverers/`
2. Export discoverer with `id` and `async discover()` method
3. Add to `ALL_DISCOVERERS` in `discoverers/index.ts`

### Modifying Input Handling

- Keyboard: `AutocompleteInput/hooks/useInputHandler.ts`
- State transitions: `AutocompleteInput/reducer.ts`
- Command execution: `services/commandHandler.ts`

### Platform Notes

- Windows backspace may trigger `key.delete` - check `inputChar`
- Windows Terminal auto-configuration in `utils/platform.ts`
