# CLAUDE.md

This file provides guidance for Claude Code when working with this repository.

## Project Overview

axiomate-cli is a terminal-based AI agent application built with React + Ink. It provides an interactive CLI interface with autocomplete, slash commands, and structured input handling.

## Tech Stack

- **React 19** + **Ink 6** - Terminal UI framework
- **TypeScript 5.7** - Language
- **Node.js >= 20** - Runtime
- **Vitest** - Testing
- **ESLint + Prettier** - Code quality

## Build & Run Commands

```bash
npm run build      # Compile TypeScript
npm run dev        # Watch mode development
npm start          # Run the CLI
npm test           # Run tests
npm run lint       # Check code style
npm run lint:fix   # Auto-fix lint issues
```

## Project Structure

```
source/
├── app.tsx                    # Main app component, handles UserInput routing
├── cli.tsx                    # Entry point, CLI argument parsing (meow)
├── components/
│   ├── AutocompleteInput/     # Core input component (modular structure)
│   │   ├── index.tsx          # Main component (composition layer)
│   │   ├── types.ts           # Type definitions + mode helpers
│   │   ├── reducer.ts         # State machine reducer
│   │   ├── hooks/
│   │   │   ├── useAutocomplete.ts  # Autocomplete logic
│   │   │   └── useInputHandler.ts  # Keyboard input handling
│   │   ├── utils/
│   │   │   └── lineProcessor.ts    # Line wrapping calculations
│   │   └── components/
│   │       ├── InputLine.tsx       # Input line rendering
│   │       ├── SlashMenu.tsx       # Slash command menu
│   │       └── HelpPanel.tsx       # Keyboard shortcuts help
│   ├── Divider.tsx            # Horizontal divider
│   ├── Header.tsx             # App header
│   └── MessageOutput.tsx      # Message display area
├── models/
│   └── input.ts               # UserInput type definitions
├── constants/
│   └── commands.ts            # Slash command definitions (SLASH_COMMANDS)
├── hooks/                     # React hooks (useTerminalWidth/Height)
├── utils/                     # Utilities (config, logger, appdata)
└── types/                     # .d.ts type declarations for untyped libs
```

## Key Architecture

### Input System

The input system uses a **structured UserInput** type instead of raw strings:

```typescript
type UserInput = MessageInput | CommandInput;

// Regular input -> sent to AI
type MessageInput = { type: "message"; content: string };

// Slash commands -> handled internally
type CommandInput = { type: "command"; command: string[]; raw: string };
```

### AutocompleteInput State Machine

The input component uses a reducer-based state machine with 4 modes:

| Mode      | Trigger | Description                        |
| --------- | ------- | ---------------------------------- |
| `normal`  | default | Regular input with autocomplete    |
| `history` | ↑/↓     | Browse command history             |
| `slash`   | `/`     | Navigate hierarchical commands     |
| `help`    | `?`     | Display shortcuts overlay          |

Key types (defined in `AutocompleteInput/types.ts`):
- `InputMode` - Union type for mode states
- `InputState` - Contains input, cursor, suggestion, mode
- `InputAction` - Reducer actions

Module responsibilities:
- `reducer.ts` - Pure state machine logic, easily testable
- `useAutocomplete.ts` - Async autocomplete + slash command filtering
- `useInputHandler.ts` - All keyboard event handling
- `lineProcessor.ts` - Text wrapping and cursor position calculation

### Slash Commands

Slash commands support nested hierarchy defined in `constants/commands.ts`:

```typescript
type SlashCommand = {
  name: string;
  description?: string;
  children?: SlashCommand[];  // Nested subcommands
};
```

Example: `/model openai gpt-4` parses to `command: ["model", "openai", "gpt-4"]`

### Component Communication

```
AutocompleteInput
    │
    ├── onSubmit(UserInput)  → App handles message/command routing
    ├── onClear()            → App clears messages
    └── onExit()             → App exits
```

## Code Conventions

- Use `useMemo` for derived values that are dependencies of other hooks
- Use `useCallback` for event handlers
- Prefer `if/else` over ternary expressions for statements (ESLint rule)
- Types go in `models/` folder, `.d.ts` declarations go in `types/`
- Chinese comments are acceptable in this codebase

## Common Tasks

### Adding a new slash command

1. Add to `SLASH_COMMANDS` in `constants/commands.ts`
2. Handle in `App.tsx` `handleSubmit` switch statement

### Adding a new input mode

1. Extend `InputMode` type in `AutocompleteInput/types.ts`
2. Add corresponding `InputAction` types in `types.ts`
3. Update `inputReducer` in `reducer.ts` to handle transitions
4. Add mode detection helper in `types.ts` (e.g., `isNewMode()`)
5. Handle keyboard events in `hooks/useInputHandler.ts`

### Modifying input handling

- Keyboard logic: `AutocompleteInput/hooks/useInputHandler.ts`
- Autocomplete logic: `AutocompleteInput/hooks/useAutocomplete.ts`
- State transitions: `AutocompleteInput/reducer.ts`
- Submit handling: `App.tsx` `handleSubmit` callback
