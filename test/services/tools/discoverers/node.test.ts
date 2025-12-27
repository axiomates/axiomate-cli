import { describe, it, expect, vi, beforeEach } from "vitest";
import { detectNode } from "../../../../source/services/tools/discoverers/node.js";

// Mock base module
vi.mock("../../../../source/services/tools/discoverers/base.js", () => ({
	commandExists: vi.fn(),
	getExecutablePath: vi.fn(),
	getVersion: vi.fn(),
	createInstalledTool: vi.fn((def, path, version) => ({
		...def,
		executablePath: path,
		version,
		installed: true,
	})),
	createNotInstalledTool: vi.fn((def) => ({
		...def,
		executablePath: "",
		installed: false,
	})),
}));

import {
	commandExists,
	getExecutablePath,
	getVersion,
} from "../../../../source/services/tools/discoverers/base.js";

describe("node discoverer", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("detectNode", () => {
		it("should return not installed tool when node is not found", async () => {
			vi.mocked(commandExists).mockResolvedValue(false);

			const result = await detectNode();

			expect(result.installed).toBe(false);
			expect(result.id).toBe("node");
		});

		it("should return installed tool when node exists", async () => {
			vi.mocked(commandExists).mockResolvedValue(true);
			vi.mocked(getExecutablePath).mockResolvedValue("/usr/bin/node");
			vi.mocked(getVersion).mockResolvedValue("v20.10.0");

			const result = await detectNode();

			expect(result.installed).toBe(true);
			expect(result.executablePath).toBe("/usr/bin/node");
			expect(result.version).toBe("v20.10.0");
		});

		it("should have node actions", async () => {
			vi.mocked(commandExists).mockResolvedValue(true);
			vi.mocked(getExecutablePath).mockResolvedValue("/usr/bin/node");
			vi.mocked(getVersion).mockResolvedValue("v20.10.0");

			const result = await detectNode();

			expect(result.actions.some((a) => a.name === "run")).toBe(true);
			expect(result.actions.some((a) => a.name === "eval")).toBe(true);
			expect(result.actions.some((a) => a.name === "version")).toBe(true);
		});

		it("should handle null executable path", async () => {
			vi.mocked(commandExists).mockResolvedValue(true);
			vi.mocked(getExecutablePath).mockResolvedValue(null);
			vi.mocked(getVersion).mockResolvedValue("v20.10.0");

			const result = await detectNode();

			expect(result.installed).toBe(true);
			expect(result.executablePath).toBe("node");
		});
	});
});
