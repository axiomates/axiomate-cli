/**
 * File operations handler
 * Handles file read, write, edit, search, and read_lines actions
 */

import { join, isAbsolute } from "node:path";
import type { RegisteredHandler, ExecutionResult } from "./types.js";
import {
	readFileContent,
	writeFileContent,
	editFileContent,
	readFileLines,
	searchInFile,
	type WriteMode,
} from "../fileOperations.js";

/**
 * File handler - handles all __FILE_* actions
 */
export const fileHandler: RegisteredHandler = {
	name: "file",
	matches: (ctx) => ctx.action.commandTemplate.startsWith("__FILE_"),
	handle: async (ctx) => {
		const { action, params, options } = ctx;
		const cwd = options?.cwd || process.cwd();

		switch (action.commandTemplate) {
			case "__FILE_READ__":
				return handleFileRead(params, cwd);
			case "__FILE_READ_LINES__":
				return handleFileReadLines(params, cwd);
			case "__FILE_WRITE__":
				return handleFileWrite(params, cwd);
			case "__FILE_SEARCH__":
				return handleFileSearch(params, cwd);
			case "__FILE_EDIT__":
				return handleFileEdit(params, cwd);
			default:
				return {
					success: false,
					stdout: "",
					stderr: "",
					exitCode: null,
					error: `Unknown file action: ${action.commandTemplate}`,
				};
		}
	},
};

function resolvePath(path: string, cwd: string): string {
	return isAbsolute(path) ? path : join(cwd, path);
}

function handleFileRead(
	params: Record<string, unknown>,
	cwd: string,
): ExecutionResult {
	const path = params.path as string;
	const encoding = params.encoding as string | undefined;
	const fullPath = resolvePath(path, cwd);

	const result = readFileContent(fullPath, encoding);
	const encodingInfo = result.encoding
		? `[Encoding: ${result.encoding.encoding}${result.encoding.hasBOM ? " (with BOM)" : ""}]\n`
		: "";

	return {
		success: result.success,
		stdout: result.success ? encodingInfo + (result.content || "") : "",
		stderr: "",
		exitCode: result.success ? 0 : 1,
		error: result.error,
	};
}

function handleFileReadLines(
	params: Record<string, unknown>,
	cwd: string,
): ExecutionResult {
	const path = params.path as string;
	const startLine = (params.start_line as number) || 1;
	const endLine = (params.end_line as number) ?? -1;
	const fullPath = resolvePath(path, cwd);

	const result = readFileLines(fullPath, startLine, endLine);
	const header = result.success
		? `[Lines ${result.startLine}-${result.endLine} of ${result.totalLines}]\n`
		: "";

	return {
		success: result.success,
		stdout: result.success ? header + (result.lines?.join("\n") || "") : "",
		stderr: "",
		exitCode: result.success ? 0 : 1,
		error: result.error,
	};
}

function handleFileWrite(
	params: Record<string, unknown>,
	cwd: string,
): ExecutionResult {
	const path = params.path as string;
	const content = params.content as string;
	const mode = (params.mode as WriteMode) || "overwrite";
	const encoding = params.encoding as string | undefined;
	const fullPath = resolvePath(path, cwd);

	const result = writeFileContent(fullPath, content, mode, encoding);

	return {
		success: result.success,
		stdout: result.success
			? `Written to ${result.path} (encoding: ${result.encoding || "utf-8"})`
			: "",
		stderr: "",
		exitCode: result.success ? 0 : 1,
		error: result.error,
	};
}

function handleFileSearch(
	params: Record<string, unknown>,
	cwd: string,
): ExecutionResult {
	const path = params.path as string;
	const pattern = params.pattern as string;
	const isRegex = params.regex === true;
	const maxMatches = (params.max_matches as number) || 100;
	const fullPath = resolvePath(path, cwd);

	const searchPattern = isRegex ? new RegExp(pattern, "gm") : pattern;
	const result = searchInFile(fullPath, searchPattern, maxMatches);

	const output = result.success
		? result.matches.length > 0
			? result.matches
					.map((m) => `${m.line}:${m.column}: ${m.content}`)
					.join("\n")
			: "(no matches)"
		: "";

	return {
		success: result.success,
		stdout: output,
		stderr: "",
		exitCode: result.success ? 0 : 1,
		error: result.error,
	};
}

function handleFileEdit(
	params: Record<string, unknown>,
	cwd: string,
): ExecutionResult {
	const path = params.path as string;
	const oldContent = params.old_content as string;
	const newContent = params.new_content as string;
	const replaceAll = params.replace_all === true;
	const fullPath = resolvePath(path, cwd);

	const result = editFileContent(fullPath, oldContent, newContent, replaceAll);

	return {
		success: result.success,
		stdout: result.success
			? `Replaced ${result.replaced} occurrence(s) in ${result.path}`
			: "",
		stderr: "",
		exitCode: result.success ? 0 : 1,
		error: result.error,
	};
}
