/**
 * Tool command executor
 * Handles command template rendering and execution
 *
 * NOTE: Shell commands from AI are executed as-is without escaping.
 * Escaping would break valid shell syntax ($variables, backticks, pipes, etc.)
 */

import type { DiscoveredTool, ToolAction, ToolParameter } from "./types.js";

// Import and register handlers
import { registerHandler, findHandler } from "./handlers/index.js";
import { webHandler } from "./handlers/webHandler.js";
import { fileHandler } from "./handlers/fileHandler.js";
import { planFileHandler } from "./handlers/planFileHandler.js";
import { planModeHandler } from "./handlers/planModeHandler.js";
import { scriptHandler } from "./handlers/scriptHandler.js";
import { commandHandler } from "./handlers/commandHandler.js";

// Import shared utilities for re-export
import {
	renderCommandTemplate,
	validateParams,
	fillDefaults,
	executeCommand,
} from "./executorUtils.js";

// Import script execution for re-export
import { executeScript } from "./handlers/scriptHandler.js";

// Re-export types and utilities for backward compatibility
export type { ExecutionResult } from "./handlers/types.js";
export {
	renderCommandTemplate,
	validateParams,
	fillDefaults,
	executeCommand,
	executeScript,
};

// Register handlers in order (first match wins)
// Order matters: specific handlers before fallback
registerHandler(webHandler);
registerHandler(fileHandler);
registerHandler(planFileHandler);
registerHandler(planModeHandler);
registerHandler(scriptHandler);
registerHandler(commandHandler); // Fallback, must be last

/**
 * Execute tool action
 */
export async function executeToolAction(
	tool: DiscoveredTool,
	action: ToolAction,
	params: Record<string, unknown>,
	options?: {
		cwd?: string;
		timeout?: number;
	},
): Promise<import("./handlers/types.js").ExecutionResult> {
	if (!tool.installed) {
		return {
			success: false,
			stdout: "",
			stderr: "",
			exitCode: null,
			error: `Tool ${tool.name} is not installed. ${tool.installHint || ""}`,
		};
	}

	const validation = validateParams(action, params);
	if (!validation.valid) {
		return {
			success: false,
			stdout: "",
			stderr: "",
			exitCode: null,
			error: `Parameter validation failed: ${validation.errors.join(", ")}`,
		};
	}

	const filledParams = fillDefaults(action, params);
	const ctx = { tool, action, params: filledParams, options };

	// Find and execute handler
	const handler = findHandler(ctx);
	if (handler) {
		return handler(ctx);
	}

	// Should never reach here if commandHandler is registered as fallback
	return {
		success: false,
		stdout: "",
		stderr: "",
		exitCode: null,
		error: `No handler found for action: ${action.commandTemplate}`,
	};
}

/**
 * Get tool action by name
 */
export function getToolAction(
	tool: DiscoveredTool,
	actionName: string,
): ToolAction | undefined {
	return tool.actions.find((a) => a.name === actionName);
}

/**
 * Convert parameter definitions to JSON Schema (for MCP/OpenAI)
 */
export function paramsToJsonSchema(params: ToolParameter[]): {
	type: "object";
	properties: Record<string, unknown>;
	required: string[];
} {
	const properties: Record<string, unknown> = {};
	const required: string[] = [];

	for (const param of params) {
		const schema: Record<string, unknown> = {
			description: param.description,
		};

		switch (param.type) {
			case "string":
			case "file":
			case "directory":
				schema.type = "string";
				break;
			case "number":
				schema.type = "number";
				break;
			case "boolean":
				schema.type = "boolean";
				break;
		}

		if (param.default !== undefined) {
			schema.default = param.default;
		}

		properties[param.name] = schema;

		if (param.required) {
			required.push(param.name);
		}
	}

	return {
		type: "object",
		properties,
		required,
	};
}
