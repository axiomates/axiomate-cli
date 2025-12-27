import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as childProcess from "child_process";

// Mock dependencies
vi.mock("child_process", () => ({
	execSync: vi.fn(),
	spawn: vi.fn(() => ({
		on: vi.fn((event, callback) => {
			if (event === "close") {
				setTimeout(callback, 0);
			}
		}),
	})),
}));

vi.mock("fs", () => ({
	existsSync: vi.fn(),
	readFileSync: vi.fn(),
	writeFileSync: vi.fn(),
	copyFileSync: vi.fn(),
}));

vi.mock("os", () => ({
	platform: vi.fn(() => "win32"),
}));

import * as fs from "fs";
import * as os from "os";
import { initPlatform, restartApp } from "../../source/utils/platform.js";

describe("platform", () => {
	const originalExecPath = process.execPath;
	const originalArgv = process.argv;

	beforeEach(() => {
		vi.clearAllMocks();
		// Reset process properties
		Object.defineProperty(process, "execPath", {
			value: "C:\\Program Files\\axiomate\\axiomate.exe",
			writable: true,
		});
		Object.defineProperty(process, "argv", {
			value: ["node", "script.js"],
			writable: true,
		});
	});

	afterEach(() => {
		Object.defineProperty(process, "execPath", {
			value: originalExecPath,
			writable: true,
		});
		Object.defineProperty(process, "argv", {
			value: originalArgv,
			writable: true,
		});
	});

	describe("initPlatform", () => {
		it("should return false on non-Windows platform", () => {
			vi.mocked(os.platform).mockReturnValue("linux");

			const result = initPlatform();

			expect(result).toBe(false);
		});

		it("should return false when running under node (not packaged)", () => {
			vi.mocked(os.platform).mockReturnValue("win32");
			Object.defineProperty(process, "execPath", {
				value: "C:\\Program Files\\nodejs\\node.exe",
				writable: true,
			});

			const result = initPlatform();

			expect(result).toBe(false);
		});

		it("should return false when settings file not found", () => {
			vi.mocked(os.platform).mockReturnValue("win32");
			vi.mocked(fs.existsSync).mockReturnValue(false);

			const result = initPlatform();

			expect(result).toBe(false);
		});

		it("should return false when profile already up to date", () => {
			vi.mocked(os.platform).mockReturnValue("win32");
			vi.mocked(fs.existsSync).mockReturnValue(true);
			vi.mocked(fs.readFileSync).mockReturnValue(
				JSON.stringify({
					profiles: {
						list: [
							{
								guid: "{a010a7e0-c110-4a99-b07b-9f0f11e00000}",
								name: "axiomate",
								commandline: "C:\\Program Files\\axiomate\\axiomate.exe",
								icon: "C:\\Program Files\\axiomate\\axiomate.exe",
							},
						],
					},
				}),
			);

			const result = initPlatform();

			expect(result).toBe(false);
			expect(fs.writeFileSync).not.toHaveBeenCalled();
		});

		it("should update settings when profile needs update", () => {
			vi.mocked(os.platform).mockReturnValue("win32");
			vi.mocked(fs.existsSync).mockReturnValue(true);
			vi.mocked(fs.readFileSync).mockReturnValue(
				JSON.stringify({
					profiles: {
						list: [],
					},
				}),
			);

			const result = initPlatform();

			expect(result).toBe(true);
			expect(fs.copyFileSync).toHaveBeenCalled(); // Backup
			expect(fs.writeFileSync).toHaveBeenCalled();
		});

		it("should handle JSON with comments", () => {
			vi.mocked(os.platform).mockReturnValue("win32");
			vi.mocked(fs.existsSync).mockReturnValue(true);
			vi.mocked(fs.readFileSync).mockReturnValue(`{
				// This is a comment
				"profiles": {
					"list": [] // Trailing comment
				}
			}`);

			const result = initPlatform();

			expect(result).toBe(true);
		});

		it("should handle settings without profiles section", () => {
			vi.mocked(os.platform).mockReturnValue("win32");
			vi.mocked(fs.existsSync).mockReturnValue(true);
			vi.mocked(fs.readFileSync).mockReturnValue("{}");

			const result = initPlatform();

			expect(result).toBe(true);
		});

		it("should update existing profile with legacy GUID", () => {
			vi.mocked(os.platform).mockReturnValue("win32");
			vi.mocked(fs.existsSync).mockReturnValue(true);
			vi.mocked(fs.readFileSync).mockReturnValue(
				JSON.stringify({
					profiles: {
						list: [
							{
								guid: "{a]x1om4te-c1i0-4app-b0th-pr0f1leguid0}",
								name: "axiomate",
								commandline: "old-path",
								icon: "old-icon",
							},
						],
					},
				}),
			);

			const result = initPlatform();

			expect(result).toBe(true);
		});

		it("should return false on parse error", () => {
			vi.mocked(os.platform).mockReturnValue("win32");
			vi.mocked(fs.existsSync).mockReturnValue(true);
			vi.mocked(fs.readFileSync).mockReturnValue("invalid json {");

			const result = initPlatform();

			expect(result).toBe(false);
		});

		it("should handle profiles with null list", () => {
			vi.mocked(os.platform).mockReturnValue("win32");
			vi.mocked(fs.existsSync).mockReturnValue(true);
			vi.mocked(fs.readFileSync).mockReturnValue(
				JSON.stringify({
					profiles: {},
				}),
			);

			const result = initPlatform();

			expect(result).toBe(true);
		});

		it("should handle multi-line comments in JSON", () => {
			vi.mocked(os.platform).mockReturnValue("win32");
			vi.mocked(fs.existsSync).mockReturnValue(true);
			vi.mocked(fs.readFileSync).mockReturnValue(`{
				/* Multi-line
				   comment */
				"profiles": {
					"list": []
				}
			}`);

			const result = initPlatform();

			expect(result).toBe(true);
		});

		it("should handle trailing commas in JSON", () => {
			vi.mocked(os.platform).mockReturnValue("win32");
			vi.mocked(fs.existsSync).mockReturnValue(true);
			vi.mocked(fs.readFileSync).mockReturnValue(`{
				"profiles": {
					"list": [],
				},
			}`);

			const result = initPlatform();

			expect(result).toBe(true);
		});

		it("should update existing profile found by name", () => {
			vi.mocked(os.platform).mockReturnValue("win32");
			vi.mocked(fs.existsSync).mockReturnValue(true);
			vi.mocked(fs.readFileSync).mockReturnValue(
				JSON.stringify({
					profiles: {
						list: [
							{
								guid: "{some-other-guid}",
								name: "axiomate",
								commandline: "old-path",
								icon: "old-icon",
							},
						],
					},
				}),
			);

			const result = initPlatform();

			expect(result).toBe(true);
			expect(fs.writeFileSync).toHaveBeenCalled();
		});
	});

	describe("restartApp", () => {
		const originalExit = process.exit;
		let exitMock: ReturnType<typeof vi.fn>;

		beforeEach(() => {
			exitMock = vi.fn();
			process.exit = exitMock as unknown as typeof process.exit;
		});

		afterEach(() => {
			process.exit = originalExit;
		});

		it("should spawn wt.exe on Windows when available", async () => {
			vi.mocked(os.platform).mockReturnValue("win32");
			vi.mocked(childProcess.execSync).mockImplementation((cmd) => {
				if (cmd.includes("wt.exe")) return Buffer.from("");
				throw new Error("not found");
			});

			const promise = restartApp();

			// Allow spawn callback to execute
			await new Promise((r) => setTimeout(r, 10));

			expect(childProcess.spawn).toHaveBeenCalledWith(
				"wt.exe",
				expect.arrayContaining(["-d"]),
				expect.any(Object),
			);
		});

		it("should spawn powershell on Windows when wt not available", async () => {
			vi.resetModules();
			vi.mocked(os.platform).mockReturnValue("win32");
			vi.mocked(childProcess.execSync).mockImplementation((cmd) => {
				if (cmd.includes("powershell.exe")) return Buffer.from("");
				throw new Error("not found");
			});

			// Import fresh to reset restartPromise
			const { restartApp: freshRestartApp } = await import(
				"../../source/utils/platform.js"
			);

			const promise = freshRestartApp();
			await new Promise((r) => setTimeout(r, 10));

			expect(childProcess.spawn).toHaveBeenCalledWith(
				"powershell.exe",
				expect.arrayContaining(["-Command"]),
				expect.any(Object),
			);
		});
	});
});
