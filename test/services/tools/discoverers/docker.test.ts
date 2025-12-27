import { describe, it, expect, vi, beforeEach } from "vitest";
import { detectDocker } from "../../../../source/services/tools/discoverers/docker.js";

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

describe("docker discoverer", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("detectDocker", () => {
		it("should return not installed tool when docker is not found", async () => {
			vi.mocked(commandExists).mockResolvedValue(false);

			const result = await detectDocker();

			expect(result.installed).toBe(false);
			expect(result.id).toBe("docker");
		});

		it("should return installed tool when docker exists", async () => {
			vi.mocked(commandExists).mockResolvedValue(true);
			vi.mocked(getExecutablePath).mockResolvedValue("/usr/bin/docker");
			vi.mocked(getVersion).mockResolvedValue("Docker version 24.0.0");

			const result = await detectDocker();

			expect(result.installed).toBe(true);
			expect(result.executablePath).toBe("/usr/bin/docker");
		});

		it("should have container management actions", async () => {
			vi.mocked(commandExists).mockResolvedValue(true);
			vi.mocked(getExecutablePath).mockResolvedValue("/usr/bin/docker");
			vi.mocked(getVersion).mockResolvedValue("Docker version 24.0.0");

			const result = await detectDocker();

			expect(result.actions.some((a) => a.name === "ps")).toBe(true);
			expect(result.actions.some((a) => a.name === "images")).toBe(true);
		});

		it("should handle null executable path", async () => {
			vi.mocked(commandExists).mockResolvedValue(true);
			vi.mocked(getExecutablePath).mockResolvedValue(null);
			vi.mocked(getVersion).mockResolvedValue("Docker version 24.0.0");

			const result = await detectDocker();

			expect(result.installed).toBe(true);
			expect(result.executablePath).toBe("docker");
		});
	});
});
