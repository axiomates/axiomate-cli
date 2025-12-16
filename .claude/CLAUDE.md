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
│   └── AutocompleteInput.tsx  # Core input component with state machine
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

The input component (`AutocompleteInput.tsx`) uses a reducer-based state machine with 4 modes:

| Mode      | Trigger | Description                        |
| --------- | ------- | ---------------------------------- |
| `normal`  | default | Regular input with autocomplete    |
| `history` | ↑/↓     | Browse command history             |
| `slash`   | `/`     | Navigate hierarchical commands     |
| `help`    | `?`     | Display shortcuts overlay          |

Key types in AutocompleteInput:
- `InputMode` - Union type for mode states
- `InputState` - Contains input, cursor, suggestion, mode
- `InputAction` - Reducer actions

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

1. Extend `InputMode` type in `AutocompleteInput.tsx`
2. Add corresponding `InputAction` types
3. Update `inputReducer` to handle transitions
4. Add mode detection helper (e.g., `isNewMode()`)

### Modifying input handling

The `handleSubmit` callback in `AutocompleteInput.tsx` creates `UserInput` objects. Business logic for commands should be in `App.tsx`, not in the input component.
