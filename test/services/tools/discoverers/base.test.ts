import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
	commandExists,
	getExecutablePath,
	getVersion,
	fileExists,
	queryRegistry,
	findVisualStudio,
	createNotInstalledTool,
	createInstalledTool,
} from "../../../../source/services/tools/discoverers/base.js";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { platform } from "node:os";
import type { ToolDefinition } from "../../../../source/services/tools/types.js";

// Mock modules
vi.mock("node:child_process", () => ({
	spawn: vi.fn(),
}));

vi.mock("node:fs", () => ({
	existsSync: vi.fn(),
}));

vi.mock("node:os", () => ({
	platform: vi.fn(() => "win32"),
}));

// Helper to create mock process
function createMockProcess(
	stdout: string,
	stderr: string,
	exitCode: number,
	options?: { delay?: number; error?: boolean },
) {
	const stdoutListeners: ((data: Buffer) => void)[] = [];
	const stderrListeners: ((data: Buffer) => void)[] = [];
	const closeListeners: ((code: number) => void)[] = [];
	const errorListeners: ((err: Error) => void)[] = [];

	const mockProc = {
		stdout: {
			on: vi.fn((event: string, callback: (data: Buffer) => void) => {
				if (event === "data") stdoutListeners.push(callback);
			}),
		},
		stderr: {
			on: vi.fn((event: string, callback: (data: Buffer) => void) => {
				if (event === "data") stderrListeners.push(callback);
			}),
		},
		on: vi.fn(
			(event: string, callback: (codeOrErr: number | Error) => void) => {
				if (event === "close")
					closeListeners.push(callback as (code: number) => void);
				if (event === "error")
					errorListeners.push(callback as (err: Error) => void);
			},
		),
		kill: vi.fn(),
	};

	// Simulate async behavior
	setTimeout(() => {
		if (options?.error) {
			errorListeners.forEach((cb) => cb(new Error("spawn error")));
		} else {
			if (stdout) {
				stdoutListeners.forEach((cb) => cb(Buffer.from(stdout)));
			}
			if (stderr) {
				stderrListeners.forEach((cb) => cb(Buffer.from(stderr)));
			}
			closeListeners.forEach((cb) => cb(exitCode));
		}
	}, options?.delay ?? 0);

	return mockProc;
}

describe("discoverers/base", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	describe("commandExists", () => {
		it("should return true when command exists on Windows", async () => {
			vi.mocked(platform).mockReturnValue("win32");
			vi.mocked(spawn).mockReturnValue(
				createMockProcess("C:\\Windows\\System32\\cmd.exe\n", "", 0) as any,
			);

			const resultPromise = commandExists("cmd");
			await vi.advanceTimersByTimeAsync(100);
			const result = await resultPromise;

			expect(result).toBe(true);
			expect(spawn).toHaveBeenCalledWith("where", ["cmd"], expect.any(Object));
		});

		it("should return true when command exists on Unix", async () => {
			vi.mocked(platform).mockReturnValue("linux");
			// Need to reimport to get new platform value - just test the spawn call
			vi.mocked(spawn).mockReturnValue(
				createMockProcess("/usr/bin/node\n", "", 0) as any,
			);

			const resultPromise = commandExists("node");
			await vi.advanceTimersByTimeAsync(100);
			const result = await resultPromise;

			expect(result).toBe(true);
		});

		it("should return false when command does not exist", async () => {
			vi.mocked(spawn).mockReturnValue(
				createMockProcess("", "not found", 1) as any,
			);

			const resultPromise = commandExists("nonexistent");
			await vi.advanceTimersByTimeAsync(100);
			const result = await resultPromise;

			expect(result).toBe(false);
		});

		it("should handle timeout", async () => {
			const mockProc = createMockProcess("", "", 0, { delay: 5000 });
			vi.mocked(spawn).mockReturnValue(mockProc as any);

			const resultPromise = commandExists("slow");
			await vi.advanceTimersByTimeAsync(3500); // Past timeout
			const result = await resultPromise;

			expect(result).toBe(false);
			expect(mockProc.kill).toHaveBeenCalled();
		});
	});

	describe("getExecutablePath", () => {
		it("should return path when command exists", async () => {
			vi.mocked(spawn).mockReturnValue(
				createMockProcess("C:\\Windows\\System32\\git.exe\n", "", 0) as any,
			);

			const resultPromise = getExecutablePath("git");
			await vi.advanceTimersByTimeAsync(100);
			const result = await resultPromise;

			expect(result).toBe("C:\\Windows\\System32\\git.exe");
		});

		it("should return first path when multiple found", async () => {
			vi.mocked(spawn).mockReturnValue(
				createMockProcess(
					"C:\\First\\git.exe\nC:\\Second\\git.exe\n",
					"",
					0,
				) as any,
			);

			const resultPromise = getExecutablePath("git");
			await vi.advanceTimersByTimeAsync(100);
			const result = await resultPromise;

			expect(result).toBe("C:\\First\\git.exe");
		});

		it("should return null when command not found", async () => {
			vi.mocked(spawn).mockReturnValue(
				createMockProcess("", "not found", 1) as any,
			);

			const resultPromise = getExecutablePath("nonexistent");
			await vi.advanceTimersByTimeAsync(100);
			const result = await resultPromise;

			expect(result).toBe(null);
		});

		it("should return null for empty stdout", async () => {
			vi.mocked(spawn).mockReturnValue(createMockProcess("", "", 0) as any);

			const resultPromise = getExecutablePath("empty");
			await vi.advanceTimersByTimeAsync(100);
			const result = await resultPromise;

			expect(result).toBe(null);
		});
	});

	describe("getVersion", () => {
		it("should return version from stdout", async () => {
			vi.mocked(spawn).mockReturnValue(
				createMockProcess("git version 2.40.0.windows.1\n", "", 0) as any,
			);

			const resultPromise = getVersion("git");
			await vi.advanceTimersByTimeAsync(100);
			const result = await resultPromise;

			expect(result).toBe("git version 2.40.0.windows.1");
		});

		it("should use custom args", async () => {
			vi.mocked(spawn).mockReturnValue(
				createMockProcess("1.0.0\n", "", 0) as any,
			);

			const resultPromise = getVersion("myapp", ["-v"]);
			await vi.advanceTimersByTimeAsync(100);
			await resultPromise;

			expect(spawn).toHaveBeenCalledWith(
				"myapp",
				["-v"],
				expect.any(Object),
			);
		});

		it("should use stderr when useStderr option is true", async () => {
			vi.mocked(spawn).mockReturnValue(
				createMockProcess(
					"",
					'java version "17.0.1" 2021-10-19 LTS\n',
					0,
				) as any,
			);

			const resultPromise = getVersion("java", ["-version"], {
				useStderr: true,
			});
			await vi.advanceTimersByTimeAsync(100);
			const result = await resultPromise;

			expect(result).toBe('java version "17.0.1" 2021-10-19 LTS');
		});

		it("should use custom parseOutput function", async () => {
			vi.mocked(spawn).mockReturnValue(
				createMockProcess("Version: 1.2.3\nBuild: 456\n", "", 0) as any,
			);

			const resultPromise = getVersion("myapp", ["--version"], {
				parseOutput: (output) => {
					const match = output.match(/Version: (\d+\.\d+\.\d+)/);
					return match?.[1] || null;
				},
			});
			await vi.advanceTimersByTimeAsync(100);
			const result = await resultPromise;

			expect(result).toBe("1.2.3");
		});

		it("should return null when no output", async () => {
			vi.mocked(spawn).mockReturnValue(createMockProcess("", "", 0) as any);

			const resultPromise = getVersion("nooutput");
			await vi.advanceTimersByTimeAsync(100);
			const result = await resultPromise;

			expect(result).toBe(null);
		});
	});

	describe("fileExists", () => {
		it("should return true when file exists", () => {
			vi.mocked(existsSync).mockReturnValue(true);

			const result = fileExists("/path/to/file");

			expect(result).toBe(true);
			expect(existsSync).toHaveBeenCalledWith("/path/to/file");
		});

		it("should return false when file does not exist", () => {
			vi.mocked(existsSync).mockReturnValue(false);

			const result = fileExists("/path/to/nonexistent");

			expect(result).toBe(false);
		});
	});

	describe("queryRegistry", () => {
		it("should query registry with value name", async () => {
			vi.mocked(spawn).mockReturnValue(
				createMockProcess(
					`
HKEY_LOCAL_MACHINE\\Software\\Test
    Version    REG_SZ    1.0.0
`,
					"",
					0,
				) as any,
			);

			const resultPromise = queryRegistry(
				"HKEY_LOCAL_MACHINE\\Software\\Test",
				"Version",
			);
			await vi.advanceTimersByTimeAsync(100);
			const result = await resultPromise;

			expect(result).toBe("1.0.0");
			expect(spawn).toHaveBeenCalledWith(
				"reg",
				["query", "HKEY_LOCAL_MACHINE\\Software\\Test", "/v", "Version"],
				expect.any(Object),
			);
		});

		it("should return REG_EXPAND_SZ value type", async () => {
			vi.mocked(spawn).mockReturnValue(
				createMockProcess(
					`
HKEY_LOCAL_MACHINE\\Software\\Test
    Path    REG_EXPAND_SZ    %ProgramFiles%\\App
`,
					"",
					0,
				) as any,
			);

			const resultPromise = queryRegistry(
				"HKEY_LOCAL_MACHINE\\Software\\Test",
				"Path",
			);
			await vi.advanceTimersByTimeAsync(100);
			const result = await resultPromise;

			expect(result).toBe("%ProgramFiles%\\App");
		});

		it("should return null when value not found", async () => {
			vi.mocked(spawn).mockReturnValue(
				createMockProcess("", "not found", 1) as any,
			);

			const resultPromise = queryRegistry("HKLM\\Nonexistent");
			await vi.advanceTimersByTimeAsync(100);
			const result = await resultPromise;

			expect(result).toBe(null);
		});

		it("should query default value when no valueName provided", async () => {
			vi.mocked(spawn).mockReturnValue(
				createMockProcess(
					`
HKEY_LOCAL_MACHINE\\Software\\Test
    (Default)    REG_SZ    DefaultValue
`,
					"",
					0,
				) as any,
			);

			const resultPromise = queryRegistry("HKEY_LOCAL_MACHINE\\Software\\Test");
			await vi.advanceTimersByTimeAsync(100);
			const result = await resultPromise;

			expect(result).toBe("DefaultValue");
		});
	});

	describe("findVisualStudio", () => {
		it("should find VS using vswhere in standard location", async () => {
			vi.mocked(existsSync).mockImplementation((path) =>
				(path as string).includes("vswhere.exe"),
			);
			vi.mocked(spawn).mockReturnValue(
				createMockProcess(
					JSON.stringify([
						{
							installationPath: "C:\\Program Files\\Microsoft Visual Studio\\2022\\Professional",
							installationVersion: "17.8.0",
							productId: "Microsoft.VisualStudio.Product.Professional",
						},
					]),
					"",
					0,
				) as any,
			);

			const resultPromise = findVisualStudio();
			await vi.advanceTimersByTimeAsync(100);
			const result = await resultPromise;

			expect(result).toEqual({
				installPath:
					"C:\\Program Files\\Microsoft Visual Studio\\2022\\Professional",
				version: "17.8.0",
				productId: "Microsoft.VisualStudio.Product.Professional",
			});
		});

		it("should return null when vswhere not found", async () => {
			vi.mocked(existsSync).mockReturnValue(false);
			vi.mocked(spawn).mockReturnValue(
				createMockProcess("", "not found", 1) as any,
			);

			const resultPromise = findVisualStudio();
			await vi.advanceTimersByTimeAsync(100);
			const result = await resultPromise;

			expect(result).toBe(null);
		});

		it("should return null when vswhere returns invalid JSON", async () => {
			vi.mocked(existsSync).mockImplementation((path) =>
				(path as string).includes("vswhere.exe"),
			);
			vi.mocked(spawn).mockReturnValue(
				createMockProcess("invalid json", "", 0) as any,
			);

			const resultPromise = findVisualStudio();
			await vi.advanceTimersByTimeAsync(100);
			const result = await resultPromise;

			expect(result).toBe(null);
		});

		it("should return null when vswhere returns empty array", async () => {
			vi.mocked(existsSync).mockImplementation((path) =>
				(path as string).includes("vswhere.exe"),
			);
			vi.mocked(spawn).mockReturnValue(createMockProcess("[]", "", 0) as any);

			const resultPromise = findVisualStudio();
			await vi.advanceTimersByTimeAsync(100);
			const result = await resultPromise;

			expect(result).toBe(null);
		});
	});

	describe("createNotInstalledTool", () => {
		it("should create not installed tool with correct properties", () => {
			const definition: ToolDefinition = {
				id: "git",
				name: "Git",
				description: "Version control system",
				category: "shell",
				installHint: "Install from git-scm.com",
				actions: [],
			};

			const result = createNotInstalledTool(definition);

			expect(result).toEqual({
				...definition,
				executablePath: "",
				installed: false,
			});
		});
	});

	describe("createInstalledTool", () => {
		it("should create installed tool with path and version", () => {
			const definition: ToolDefinition = {
				id: "node",
				name: "Node.js",
				description: "JavaScript runtime",
				category: "shell",
				actions: [],
			};

			const result = createInstalledTool(
				definition,
				"/usr/bin/node",
				"v20.10.0",
			);

			expect(result).toEqual({
				...definition,
				executablePath: "/usr/bin/node",
				version: "v20.10.0",
				installed: true,
			});
		});

		it("should create installed tool without version", () => {
			const definition: ToolDefinition = {
				id: "custom",
				name: "Custom Tool",
				description: "A custom tool",
				category: "local",
				actions: [],
			};

			const result = createInstalledTool(definition, "/path/to/custom");

			expect(result).toEqual({
				...definition,
				executablePath: "/path/to/custom",
				version: undefined,
				installed: true,
			});
		});
	});

	describe("execCommand edge cases", () => {
		it("should handle spawn error", async () => {
			const mockProc = createMockProcess("", "", -1, { error: true });
			vi.mocked(spawn).mockReturnValue(mockProc as any);

			const resultPromise = commandExists("error");
			await vi.advanceTimersByTimeAsync(100);
			const result = await resultPromise;

			expect(result).toBe(false);
		});
	});
});
