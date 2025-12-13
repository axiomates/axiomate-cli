import type { SlashCommand } from "../components/AutocompleteInput.js";

// 示例命令列表用于自动补全
export const COMMANDS = [
	"help",
	"exit",
	"quit",
	"clear",
	"history",
	"config",
	"config set",
	"config get",
	"config list",
	"status",
	"start",
	"stop",
	"restart",
	"logs",
	"version",
];

// 斜杠命令列表
export const SLASH_COMMANDS: SlashCommand[] = [
	{ name: "help", description: "Show available commands" },
	{ name: "clear", description: "Clear the screen" },
	{ name: "exit", description: "Exit the application" },
	{ name: "version", description: "Show version information" },
	{ name: "config", description: "Show configuration" },
	{ name: "status", description: "Show current status" },
];

// 自动补全提供函数
export async function getCommandSuggestion(
	input: string,
	signal: AbortSignal,
): Promise<string | null> {
	// 模拟异步延迟
	await new Promise<void>((resolve, reject) => {
		const timeout = setTimeout(resolve, 100);
		signal.addEventListener("abort", () => {
			clearTimeout(timeout);
			reject(new DOMException("Aborted", "AbortError"));
		});
	});

	if (signal.aborted) {
		return null;
	}

	// 查找匹配的命令
	const lowerInput = input.toLowerCase();
	const match = COMMANDS.find(
		(cmd) => cmd.toLowerCase().startsWith(lowerInput) && cmd !== input,
	);

	if (match) {
		// 返回需要补全的部分（不包括已输入的内容）
		return match.slice(input.length);
	}

	return null;
}
