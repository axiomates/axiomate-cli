/**
 * Handler registry for tool action execution
 * Manages registration and lookup of action handlers
 */

import type {
	RegisteredHandler,
	HandlerContext,
	ActionHandler,
} from "./types.js";

// Handler registry - ordered array, first match wins
const handlers: RegisteredHandler[] = [];

/**
 * Register a handler
 * Handlers are matched in registration order - first match wins
 */
export function registerHandler(handler: RegisteredHandler): void {
	handlers.push(handler);
}

/**
 * Find a matching handler for the given context
 * Returns null if no handler matches
 */
export function findHandler(ctx: HandlerContext): ActionHandler | null {
	for (const handler of handlers) {
		if (handler.matches(ctx)) {
			return handler.handle;
		}
	}
	return null;
}

/**
 * Get all registered handlers (for debugging/testing)
 */
export function getHandlers(): readonly RegisteredHandler[] {
	return handlers;
}

/**
 * Clear all handlers (for testing)
 */
export function clearHandlers(): void {
	handlers.length = 0;
}

// Re-export types
export * from "./types.js";
