/**
 * Handler types for tool action execution
 */

import type { DiscoveredTool, ToolAction } from "../types.js";

/**
 * Execution result from a handler
 */
export type ExecutionResult = {
	success: boolean;
	stdout: string;
	stderr: string;
	exitCode: number | null;
	error?: string;
};

/**
 * Context passed to all handlers
 */
export type HandlerContext = {
	tool: DiscoveredTool;
	action: ToolAction;
	params: Record<string, unknown>;
	options?: {
		cwd?: string;
		timeout?: number;
	};
};

/**
 * Handler function signature
 */
export type ActionHandler = (ctx: HandlerContext) => Promise<ExecutionResult>;

/**
 * Handler matcher - determines if handler should process this action
 */
export type HandlerMatcher = (ctx: HandlerContext) => boolean;

/**
 * Registered handler with matcher and handler function
 */
export type RegisteredHandler = {
	name: string;
	matches: HandlerMatcher;
	handle: ActionHandler;
};
