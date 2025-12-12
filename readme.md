# axiomate-cli

A terminal-based CLI application built with [Ink](https://github.com/vadimdemedes/ink) and React.

## Features

- Interactive terminal UI with fixed layout
- Auto-completion support with async provider
- Slash commands (`/help`, `/clear`, `/exit`, etc.)
- Command selection with arrow keys
- Keyboard shortcuts (Ctrl+C, Ctrl+U, Ctrl+K, etc.)
- Responsive layout that adapts to terminal size

## Requirements

- Node.js >= 20

## Install

```bash
npm install
npm run build
```

## Usage

```bash
npm start
```

Or run directly:

```bash
node dist/cli.js
```

## Commands

Type commands directly or use slash commands:

| Command | Description |
|---------|-------------|
| `help` | Show available commands |
| `clear` | Clear the screen |
| `exit` / `quit` | Exit the application |
| `version` | Show version information |

### Slash Commands

Type `/` to see available slash commands. Use arrow keys to select and Enter to execute.

| Slash Command | Description |
|---------------|-------------|
| `/help` | Show available commands |
| `/clear` | Clear the screen |
| `/exit` | Exit the application |
| `/version` | Show version information |
| `/config` | Show configuration |
| `/status` | Show current status |

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Tab` | Accept autocomplete suggestion |
| `Ctrl+C` | Exit application |
| `Ctrl+U` | Clear text before cursor |
| `Ctrl+K` | Clear text after cursor |
| `Ctrl+A` | Move cursor to start |
| `Ctrl+E` | Move cursor to end |
| `Escape` | Clear suggestion / exit slash mode |
| `↑` / `↓` | Navigate slash command list |

## Development

```bash
# Watch mode for development
npm run dev

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Lint code
npm run lint

# Fix lint issues
npm run lint:fix
```

## Tech Stack

- [Ink](https://github.com/vadimdemedes/ink) - React for CLI
- [React](https://react.dev/) - UI framework
- [meow](https://github.com/sindresorhus/meow) - CLI argument parsing
- [TypeScript](https://www.typescriptlang.org/) - Type safety
- [Vitest](https://vitest.dev/) - Testing framework

## License

MIT
