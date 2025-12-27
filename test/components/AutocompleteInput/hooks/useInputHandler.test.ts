import { describe, it, expect, vi, beforeEach } from "vitest";

// Use vi.hoisted to ensure mocks are available during hoisting
const { mockUseInput, mockExit } = vi.hoisted(() => ({
	mockUseInput: vi.fn(),
	mockExit: vi.fn(),
}));

vi.mock("ink", () => ({
	useInput: mockUseInput,
	useApp: () => ({ exit: mockExit }),
}));

// Mock React's useCallback to just return the callback directly
vi.mock("react", () => ({
	useCallback: (fn: any) => fn,
}));

// Import after mocking
import { useInputHandler } from "../../../../source/components/AutocompleteInput/hooks/useInputHandler.js";
import type { EditorState, HistoryEntry } from "../../../../source/components/AutocompleteInput/types.js";

// Helper to call hook (it just registers useInput, returns void)
function callHook(options: Parameters<typeof useInputHandler>[0]) {
	useInputHandler(options);
}

// Helper to create initial state
function createInitialState(overrides?: Partial<EditorState>): EditorState {
	return {
		instance: {
			text: "",
			cursor: 0,
			type: "message",
			segments: [{ text: "", color: undefined }],
			commandPath: [],
			filePath: [],
			selectedFiles: [],
		},
		uiMode: { type: "normal" },
		suggestion: null,
		...overrides,
	};
}

// Helper to simulate key press
function simulateKeyPress(
	inputChar: string,
	key: Partial<{
		return: boolean;
		escape: boolean;
		upArrow: boolean;
		downArrow: boolean;
		leftArrow: boolean;
		rightArrow: boolean;
		backspace: boolean;
		delete: boolean;
		tab: boolean;
		ctrl: boolean;
		meta: boolean;
		shift: boolean;
	}> = {},
) {
	const callback = mockUseInput.mock.calls[mockUseInput.mock.calls.length - 1]?.[0];
	if (callback) {
		callback(inputChar, {
			return: false,
			escape: false,
			upArrow: false,
			downArrow: false,
			leftArrow: false,
			rightArrow: false,
			backspace: false,
			delete: false,
			tab: false,
			ctrl: false,
			meta: false,
			shift: false,
			...key,
		});
	}
}

describe("useInputHandler", () => {
	let mockDispatch: ReturnType<typeof vi.fn>;
	let mockOnSubmit: ReturnType<typeof vi.fn>;
	let mockOnExit: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		vi.clearAllMocks();
		mockDispatch = vi.fn();
		mockOnSubmit = vi.fn();
		mockOnExit = vi.fn();
	});

	describe("basic input", () => {
		it("should handle character input", () => {
			const state = createInitialState();
			callHook({
				state,
				dispatch: mockDispatch,
				history: [],
				filteredCommands: [],
				filteredFiles: [],
				effectiveSuggestion: null,
				onSubmit: mockOnSubmit,
			});

			simulateKeyPress("a");

			expect(mockDispatch).toHaveBeenCalledWith({
				type: "SET_TEXT",
				text: "a",
				cursor: 1,
			});
		});

		it("should handle return key for submit", () => {
			const state = createInitialState({
				instance: {
					text: "hello",
					cursor: 5,
					type: "message",
					segments: [{ text: "hello", color: undefined }],
					commandPath: [],
					filePath: [],
					selectedFiles: [],
				},
			});
			callHook({
				state,
				dispatch: mockDispatch,
				history: [],
				filteredCommands: [],
				filteredFiles: [],
				effectiveSuggestion: null,
				onSubmit: mockOnSubmit,
			});

			simulateKeyPress("", { return: true });

			expect(mockOnSubmit).toHaveBeenCalledWith(state.instance);
		});

		it("should handle Ctrl+Enter for newline", () => {
			const state = createInitialState({
				instance: {
					text: "hello",
					cursor: 5,
					type: "message",
					segments: [{ text: "hello", color: undefined }],
					commandPath: [],
					filePath: [],
					selectedFiles: [],
				},
			});
			callHook({
				state,
				dispatch: mockDispatch,
				history: [],
				filteredCommands: [],
				filteredFiles: [],
				effectiveSuggestion: null,
				onSubmit: mockOnSubmit,
			});

			simulateKeyPress("", { return: true, ctrl: true });

			expect(mockDispatch).toHaveBeenCalledWith({
				type: "SET_TEXT",
				text: "hello\n",
				cursor: 6,
			});
		});

		it("should handle backspace", () => {
			const state = createInitialState({
				instance: {
					text: "hello",
					cursor: 5,
					type: "message",
					segments: [{ text: "hello", color: undefined }],
					commandPath: [],
					filePath: [],
					selectedFiles: [],
				},
			});
			callHook({
				state,
				dispatch: mockDispatch,
				history: [],
				filteredCommands: [],
				filteredFiles: [],
				effectiveSuggestion: null,
				onSubmit: mockOnSubmit,
			});

			simulateKeyPress("", { backspace: true });

			expect(mockDispatch).toHaveBeenCalledWith({
				type: "SET_TEXT",
				text: "hell",
				cursor: 4,
			});
		});

		it("should handle delete key", () => {
			const state = createInitialState({
				instance: {
					text: "hello",
					cursor: 0,
					type: "message",
					segments: [{ text: "hello", color: undefined }],
					commandPath: [],
					filePath: [],
					selectedFiles: [],
				},
			});
			callHook({
				state,
				dispatch: mockDispatch,
				history: [],
				filteredCommands: [],
				filteredFiles: [],
				effectiveSuggestion: null,
				onSubmit: mockOnSubmit,
			});

			simulateKeyPress("\x1b[3~", { delete: true });

			expect(mockDispatch).toHaveBeenCalledWith({
				type: "SET_TEXT",
				text: "ello",
				cursor: 0,
			});
		});
	});

	describe("cursor movement", () => {
		it("should handle left arrow", () => {
			const state = createInitialState({
				instance: {
					text: "hello",
					cursor: 3,
					type: "message",
					segments: [{ text: "hello", color: undefined }],
					commandPath: [],
					filePath: [],
					selectedFiles: [],
				},
			});
			callHook({
				state,
				dispatch: mockDispatch,
				history: [],
				filteredCommands: [],
				filteredFiles: [],
				effectiveSuggestion: null,
				onSubmit: mockOnSubmit,
			});

			simulateKeyPress("", { leftArrow: true });

			expect(mockDispatch).toHaveBeenCalledWith({
				type: "SET_CURSOR",
				cursor: 2,
			});
		});

		it("should handle right arrow", () => {
			const state = createInitialState({
				instance: {
					text: "hello",
					cursor: 3,
					type: "message",
					segments: [{ text: "hello", color: undefined }],
					commandPath: [],
					filePath: [],
					selectedFiles: [],
				},
			});
			callHook({
				state,
				dispatch: mockDispatch,
				history: [],
				filteredCommands: [],
				filteredFiles: [],
				effectiveSuggestion: null,
				onSubmit: mockOnSubmit,
			});

			simulateKeyPress("", { rightArrow: true });

			expect(mockDispatch).toHaveBeenCalledWith({
				type: "SET_CURSOR",
				cursor: 4,
			});
		});

		it("should handle Ctrl+A to go to beginning", () => {
			const state = createInitialState({
				instance: {
					text: "hello",
					cursor: 3,
					type: "message",
					segments: [{ text: "hello", color: undefined }],
					commandPath: [],
					filePath: [],
					selectedFiles: [],
				},
			});
			callHook({
				state,
				dispatch: mockDispatch,
				history: [],
				filteredCommands: [],
				filteredFiles: [],
				effectiveSuggestion: null,
				onSubmit: mockOnSubmit,
			});

			simulateKeyPress("a", { ctrl: true });

			expect(mockDispatch).toHaveBeenCalledWith({
				type: "SET_CURSOR",
				cursor: 0,
			});
		});

		it("should handle Ctrl+E to go to end", () => {
			const state = createInitialState({
				instance: {
					text: "hello",
					cursor: 0,
					type: "message",
					segments: [{ text: "hello", color: undefined }],
					commandPath: [],
					filePath: [],
					selectedFiles: [],
				},
			});
			callHook({
				state,
				dispatch: mockDispatch,
				history: [],
				filteredCommands: [],
				filteredFiles: [],
				effectiveSuggestion: null,
				onSubmit: mockOnSubmit,
			});

			simulateKeyPress("e", { ctrl: true });

			expect(mockDispatch).toHaveBeenCalledWith({
				type: "SET_CURSOR",
				cursor: 5,
			});
		});

		it("should handle Ctrl+U to clear before cursor", () => {
			const state = createInitialState({
				instance: {
					text: "hello world",
					cursor: 6,
					type: "message",
					segments: [{ text: "hello world", color: undefined }],
					commandPath: [],
					filePath: [],
					selectedFiles: [],
				},
			});
			callHook({
				state,
				dispatch: mockDispatch,
				history: [],
				filteredCommands: [],
				filteredFiles: [],
				effectiveSuggestion: null,
				onSubmit: mockOnSubmit,
			});

			simulateKeyPress("u", { ctrl: true });

			expect(mockDispatch).toHaveBeenCalledWith({
				type: "SET_TEXT",
				text: "world",
				cursor: 0,
			});
		});

		it("should handle Ctrl+K to clear after cursor", () => {
			const state = createInitialState({
				instance: {
					text: "hello world",
					cursor: 6,
					type: "message",
					segments: [{ text: "hello world", color: undefined }],
					commandPath: [],
					filePath: [],
					selectedFiles: [],
				},
			});
			callHook({
				state,
				dispatch: mockDispatch,
				history: [],
				filteredCommands: [],
				filteredFiles: [],
				effectiveSuggestion: null,
				onSubmit: mockOnSubmit,
			});

			simulateKeyPress("k", { ctrl: true });

			expect(mockDispatch).toHaveBeenCalledWith({
				type: "SET_TEXT",
				text: "hello ",
				cursor: 6,
			});
		});
	});

	describe("suggestion handling", () => {
		it("should accept suggestion on Tab", () => {
			const state = createInitialState({
				instance: {
					text: "hel",
					cursor: 3,
					type: "message",
					segments: [{ text: "hel", color: undefined }],
					commandPath: [],
					filePath: [],
					selectedFiles: [],
				},
			});
			callHook({
				state,
				dispatch: mockDispatch,
				history: [],
				filteredCommands: [],
				filteredFiles: [],
				effectiveSuggestion: "lo",
				onSubmit: mockOnSubmit,
			});

			simulateKeyPress("", { tab: true });

			expect(mockDispatch).toHaveBeenCalledWith({
				type: "SET_TEXT",
				text: "hello",
				cursor: 5,
			});
		});

		it("should accept one character on right arrow at end with suggestion", () => {
			const state = createInitialState({
				instance: {
					text: "hel",
					cursor: 3,
					type: "message",
					segments: [{ text: "hel", color: undefined }],
					commandPath: [],
					filePath: [],
					selectedFiles: [],
				},
			});
			callHook({
				state,
				dispatch: mockDispatch,
				history: [],
				filteredCommands: [],
				filteredFiles: [],
				effectiveSuggestion: "lo",
				onSubmit: mockOnSubmit,
			});

			simulateKeyPress("", { rightArrow: true });

			expect(mockDispatch).toHaveBeenCalledWith({
				type: "SET_TEXT",
				text: "hell",
				cursor: 4,
			});
		});
	});

	describe("slash command mode", () => {
		it("should navigate commands with up arrow", () => {
			const state = createInitialState({
				instance: {
					text: "/",
					cursor: 1,
					type: "command",
					segments: [{ text: "/", color: "cyan" }],
					commandPath: [],
					filePath: [],
					selectedFiles: [],
				},
				uiMode: { type: "slash", selectedIndex: 1 },
			});
			const commands = [
				{ name: "cmd1", description: "Command 1" },
				{ name: "cmd2", description: "Command 2" },
			];
			callHook({
				state,
				dispatch: mockDispatch,
				history: [],
				filteredCommands: commands,
				filteredFiles: [],
				effectiveSuggestion: null,
				onSubmit: mockOnSubmit,
			});

			simulateKeyPress("", { upArrow: true });

			expect(mockDispatch).toHaveBeenCalledWith({
				type: "SELECT_SLASH",
				index: 0,
			});
		});

		it("should navigate commands with down arrow", () => {
			const state = createInitialState({
				instance: {
					text: "/",
					cursor: 1,
					type: "command",
					segments: [{ text: "/", color: "cyan" }],
					commandPath: [],
					filePath: [],
					selectedFiles: [],
				},
				uiMode: { type: "slash", selectedIndex: 0 },
			});
			const commands = [
				{ name: "cmd1", description: "Command 1" },
				{ name: "cmd2", description: "Command 2" },
			];
			callHook({
				state,
				dispatch: mockDispatch,
				history: [],
				filteredCommands: commands,
				filteredFiles: [],
				effectiveSuggestion: null,
				onSubmit: mockOnSubmit,
			});

			simulateKeyPress("", { downArrow: true });

			expect(mockDispatch).toHaveBeenCalledWith({
				type: "SELECT_SLASH",
				index: 1,
			});
		});

		it("should submit on return for leaf command", () => {
			const state = createInitialState({
				instance: {
					text: "/",
					cursor: 1,
					type: "command",
					segments: [{ text: "/", color: "cyan" }],
					commandPath: [],
					filePath: [],
					selectedFiles: [],
				},
				uiMode: { type: "slash", selectedIndex: 0 },
			});
			const commands = [{ name: "leaf", description: "Leaf command" }];
			callHook({
				state,
				dispatch: mockDispatch,
				history: [],
				filteredCommands: commands,
				filteredFiles: [],
				effectiveSuggestion: null,
				onSubmit: mockOnSubmit,
			});

			simulateKeyPress("", { return: true });

			expect(mockDispatch).toHaveBeenCalledWith({
				type: "SELECT_FINAL_COMMAND",
				name: "leaf",
			});
			expect(mockOnSubmit).toHaveBeenCalled();
		});

		it("should exit slash mode on escape", () => {
			const state = createInitialState({
				instance: {
					text: "/",
					cursor: 1,
					type: "command",
					segments: [{ text: "/", color: "cyan" }],
					commandPath: [],
					filePath: [],
					selectedFiles: [],
				},
				uiMode: { type: "slash", selectedIndex: 0 },
			});
			callHook({
				state,
				dispatch: mockDispatch,
				history: [],
				filteredCommands: [{ name: "cmd", description: "Command" }],
				filteredFiles: [],
				effectiveSuggestion: null,
				onSubmit: mockOnSubmit,
			});

			simulateKeyPress("", { escape: true });

			expect(mockDispatch).toHaveBeenCalledWith({
				type: "EXIT_SLASH_LEVEL",
			});
		});
	});

	describe("history navigation", () => {
		it("should enter history mode on up arrow", () => {
			const state = createInitialState();
			const history: HistoryEntry[] = [
				{
					text: "previous command",
					type: "message",
					segments: [{ text: "previous command", color: undefined }],
					commandPath: [],
					filePath: [],
					selectedFiles: [],
				},
			];
			callHook({
				state,
				dispatch: mockDispatch,
				history,
				filteredCommands: [],
				filteredFiles: [],
				effectiveSuggestion: null,
				onSubmit: mockOnSubmit,
			});

			simulateKeyPress("", { upArrow: true });

			expect(mockDispatch).toHaveBeenCalledWith({
				type: "ENTER_HISTORY",
				index: 0,
				entry: history[0],
			});
		});

		it("should exit history on down arrow at end", () => {
			const state = createInitialState({
				uiMode: {
					type: "history",
					index: 0,
					savedEntry: {
						text: "",
						type: "message",
						segments: [],
						commandPath: [],
						filePath: [],
						selectedFiles: [],
					},
				},
			});
			const history: HistoryEntry[] = [
				{
					text: "only",
					type: "message",
					segments: [{ text: "only", color: undefined }],
					commandPath: [],
					filePath: [],
					selectedFiles: [],
				},
			];
			callHook({
				state,
				dispatch: mockDispatch,
				history,
				filteredCommands: [],
				filteredFiles: [],
				effectiveSuggestion: null,
				onSubmit: mockOnSubmit,
			});

			simulateKeyPress("", { downArrow: true });

			expect(mockDispatch).toHaveBeenCalledWith({
				type: "EXIT_HISTORY",
			});
		});
	});

	describe("file selection mode", () => {
		it("should enter file mode on @", () => {
			const state = createInitialState({
				instance: {
					text: "hello ",
					cursor: 6,
					type: "message",
					segments: [{ text: "hello ", color: undefined }],
					commandPath: [],
					filePath: [],
					selectedFiles: [],
				},
			});
			callHook({
				state,
				dispatch: mockDispatch,
				history: [],
				filteredCommands: [],
				filteredFiles: [],
				effectiveSuggestion: null,
				onSubmit: mockOnSubmit,
			});

			simulateKeyPress("@");

			expect(mockDispatch).toHaveBeenCalledWith({
				type: "ENTER_FILE",
				atPosition: 6,
				prefix: "hello ",
				suffix: "",
			});
		});

		it("should navigate files with up arrow", () => {
			const state = createInitialState({
				instance: {
					text: "@",
					cursor: 1,
					type: "message",
					segments: [{ text: "@", color: "cyan" }],
					commandPath: [],
					filePath: [],
					selectedFiles: [],
				},
				uiMode: {
					type: "file",
					selectedIndex: 1,
					atPosition: 0,
					prefix: "",
					suffix: "",
				},
			});
			const files = [
				{ name: "file1.ts", isDirectory: false, path: "file1.ts" },
				{ name: "file2.ts", isDirectory: false, path: "file2.ts" },
			];
			callHook({
				state,
				dispatch: mockDispatch,
				history: [],
				filteredCommands: [],
				filteredFiles: files,
				effectiveSuggestion: null,
				onSubmit: mockOnSubmit,
			});

			simulateKeyPress("", { upArrow: true });

			expect(mockDispatch).toHaveBeenCalledWith({
				type: "SELECT_FILE",
				index: 0,
			});
		});

		it("should confirm file selection on return", () => {
			const state = createInitialState({
				instance: {
					text: "@",
					cursor: 1,
					type: "message",
					segments: [{ text: "@", color: "cyan" }],
					commandPath: [],
					filePath: [],
					selectedFiles: [],
				},
				uiMode: {
					type: "file",
					selectedIndex: 0,
					atPosition: 0,
					prefix: "",
					suffix: "",
				},
			});
			const files = [{ name: "file.ts", isDirectory: false, path: "file.ts" }];
			callHook({
				state,
				dispatch: mockDispatch,
				history: [],
				filteredCommands: [],
				filteredFiles: files,
				effectiveSuggestion: null,
				onSubmit: mockOnSubmit,
			});

			simulateKeyPress("", { return: true });

			expect(mockDispatch).toHaveBeenCalledWith({
				type: "CONFIRM_FILE",
				fileName: "file.ts",
			});
		});

		it("should exit file mode on escape", () => {
			const state = createInitialState({
				instance: {
					text: "@",
					cursor: 1,
					type: "message",
					segments: [{ text: "@", color: "cyan" }],
					commandPath: [],
					filePath: [],
					selectedFiles: [],
				},
				uiMode: {
					type: "file",
					selectedIndex: 0,
					atPosition: 0,
					prefix: "",
					suffix: "",
				},
			});
			callHook({
				state,
				dispatch: mockDispatch,
				history: [],
				filteredCommands: [],
				filteredFiles: [],
				effectiveSuggestion: null,
				onSubmit: mockOnSubmit,
			});

			simulateKeyPress("", { escape: true });

			expect(mockDispatch).toHaveBeenCalledWith({
				type: "EXIT_FILE",
			});
		});
	});

	describe("help mode", () => {
		it("should toggle help on ? when input is empty", () => {
			const state = createInitialState();
			callHook({
				state,
				dispatch: mockDispatch,
				history: [],
				filteredCommands: [],
				filteredFiles: [],
				effectiveSuggestion: null,
				onSubmit: mockOnSubmit,
			});

			simulateKeyPress("?");

			expect(mockDispatch).toHaveBeenCalledWith({
				type: "TOGGLE_HELP",
			});
		});

		it("should exit help mode on escape", () => {
			const state = createInitialState({
				uiMode: { type: "help" },
			});
			callHook({
				state,
				dispatch: mockDispatch,
				history: [],
				filteredCommands: [],
				filteredFiles: [],
				effectiveSuggestion: null,
				onSubmit: mockOnSubmit,
			});

			simulateKeyPress("", { escape: true });

			expect(mockDispatch).toHaveBeenCalledTimes(1);
			expect(mockDispatch).toHaveBeenCalledWith({
				type: "TOGGLE_HELP",
			});
		});
	});

	describe("exit handling", () => {
		it("should call onExit on Ctrl+C", () => {
			const state = createInitialState();
			callHook({
				state,
				dispatch: mockDispatch,
				history: [],
				filteredCommands: [],
				filteredFiles: [],
				effectiveSuggestion: null,
				onSubmit: mockOnSubmit,
				onExit: mockOnExit,
			});

			simulateKeyPress("c", { ctrl: true });

			expect(mockOnExit).toHaveBeenCalled();
		});

		it("should call exit from useApp if no onExit provided", () => {
			const state = createInitialState();
			callHook({
				state,
				dispatch: mockDispatch,
				history: [],
				filteredCommands: [],
				filteredFiles: [],
				effectiveSuggestion: null,
				onSubmit: mockOnSubmit,
			});

			simulateKeyPress("c", { ctrl: true });

			expect(mockExit).toHaveBeenCalled();
		});
	});

	describe("isActive", () => {
		it("should pass isActive to useInput", () => {
			const state = createInitialState();
			callHook({
				state,
				dispatch: mockDispatch,
				history: [],
				filteredCommands: [],
				filteredFiles: [],
				effectiveSuggestion: null,
				onSubmit: mockOnSubmit,
				isActive: false,
			});

			expect(mockUseInput).toHaveBeenCalledWith(expect.any(Function), {
				isActive: false,
			});
		});
	});
});
