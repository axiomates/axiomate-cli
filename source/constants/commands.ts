import type { SlashCommand } from "../components/AutocompleteInput/index.js";
import { MODEL_PRESETS } from "./models.js";

/**
 * 根据模型预设生成模型选择命令
 */
function generateModelCommands(): SlashCommand[] {
	return MODEL_PRESETS.map((preset) => ({
		name: preset.id,
		description: `${preset.name}${preset.description ? ` - ${preset.description}` : ""}`,
		action: { type: "internal" as const, handler: "model_select" },
	}));
}

// 斜杠命令列表
export const SLASH_COMMANDS: SlashCommand[] = [
	{
		name: "model",
		description: "Select AI model",
		children: [
			{
				name: "list",
				description: "List available models",
				action: { type: "internal", handler: "model_list" },
			},
			// 动态生成模型选择命令
			...generateModelCommands(),
		],
	},
	{
		name: "tools",
		description: "Manage local development tools",
		children: [
			{
				name: "list",
				description: "List all available tools",
				action: { type: "internal", handler: "tools_list" },
			},
			{
				name: "refresh",
				description: "Rescan installed tools",
				action: { type: "internal", handler: "tools_refresh" },
			},
			{
				name: "stats",
				description: "Show tools statistics",
				action: { type: "internal", handler: "tools_stats" },
			},
		],
	},
	{
		name: "compact",
		description: "Summarize conversation context",
		action: {
			type: "prompt",
			template: "请帮我总结上面的对话内容，提取关键信息。",
		},
	},
	{
		name: "help",
		description: "Show available commands",
		action: { type: "internal", handler: "help" },
	},
	{
		name: "clear",
		description: "Clear the screen",
		action: { type: "internal", handler: "clear" },
	},
	{
		name: "version",
		description: "Show version information",
		action: { type: "internal", handler: "version" },
	},
	{
		name: "exit",
		description: "Exit the application",
		action: { type: "internal", handler: "exit" },
	},
];
