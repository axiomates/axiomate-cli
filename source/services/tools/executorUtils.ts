/**
 * Shared utilities for tool execution
 * Used by executor.ts and individual handlers
 */

import { spawn, type SpawnOptions } from "node:child_process";
import type { DiscoveredTool, ToolAction } from "./types.js";
import type { ExecutionResult } from "./handlers/types.js";

/**
 * Render command template
 * Replaces {{param}} placeholders with actual values
 */
export function renderCommandTemplate(
	template: string,
	params: Record<string, unknown>,
	tool?: DiscoveredTool,
): string {
	let result = template;

	// Replace special variable {{execPath}}
	if (tool) {
		result = result.replace(/\{\{execPath\}\}/g, tool.executablePath);
	}

	// Replace parameters as-is
	for (const [key, value] of Object.entries(params)) {
		const placeholder = new RegExp(`\\{\\{${key}\\}\\}`, "g");
		result = result.replace(placeholder, String(value ?? ""));
	}

	// Remove unreplaced placeholders
	result = result.replace(/\{\{[^}]+\}\}/g, "");

	// Clean up extra spaces
	result = result.replace(/\s+/g, " ").trim();

	return result;
}

/**
 * Validate parameters
 */
export function validateParams(
	action: ToolAction,
	params: Record<string, unknown>,
): { valid: boolean; errors: string[] } {
	const errors: string[] = [];

	for (const param of action.parameters) {
		const value = params[param.name];

		if (
			param.required &&
			(value === undefined || value === null || value === "")
		) {
			errors.push(`Missing required parameter: ${param.name}`);
			continue;
		}

		if (value !== undefined && value !== null) {
			switch (param.type) {
				case "number":
					if (typeof value !== "number" && isNaN(Number(value))) {
						errors.push(`Parameter ${param.name} must be a number`);
					}
					break;
				case "boolean":
					if (
						typeof value !== "boolean" &&
						value !== "true" &&
						value !== "false"
					) {
						errors.push(`Parameter ${param.name} must be a boolean`);
					}
					break;
			}
		}
	}

	return { valid: errors.length === 0, errors };
}

/**
 * Fill default values
 */
export function fillDefaults(
	action: ToolAction,
	params: Record<string, unknown>,
): Record<string, unknown> {
	const result = { ...params };

	for (const param of action.parameters) {
		if (result[param.name] === undefined && param.default !== undefined) {
			result[param.name] = param.default;
		}
	}

	return result;
}

/**
 * Execute command
 * Note: Encoding handling should be done by each tool's commandTemplate,
 * not here. This function just executes the command as-is.
 */
export async function executeCommand(
	command: string,
	options?: {
		cwd?: string;
		env?: Record<string, string>;
		timeout?: number;
		shell?: boolean;
	},
): Promise<ExecutionResult> {
	return new Promise((resolve) => {
		const spawnOptions: SpawnOptions = {
			cwd: options?.cwd,
			env: {
				...process.env,
				...options?.env,
			},
			shell: options?.shell ?? true,
			windowsHide: true,
		};

		const proc = spawn(command, [], spawnOptions);

		let stdout = "";
		let stderr = "";
		let timedOut = false;

		const timeout = options?.timeout ?? 180000; // 3 minutes default
		const timer = setTimeout(() => {
			timedOut = true;
			proc.kill("SIGTERM");
		}, timeout);

		proc.stdout?.on("data", (data: Buffer) => {
			stdout += data.toString("utf8");
		});

		proc.stderr?.on("data", (data: Buffer) => {
			stderr += data.toString("utf8");
		});

		proc.on("error", (err) => {
			clearTimeout(timer);
			resolve({
				success: false,
				stdout,
				stderr,
				exitCode: null,
				error: err.message,
			});
		});

		proc.on("close", (code) => {
			clearTimeout(timer);
			resolve({
				success: code === 0 && !timedOut,
				stdout: stdout.trim(),
				stderr: stderr.trim(),
				exitCode: code,
				error: timedOut ? "Command execution timed out" : undefined,
			});
		});
	});
}
