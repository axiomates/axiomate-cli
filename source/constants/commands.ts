import type { SlashCommand } from "../components/AutocompleteInput/index.js";

// 斜杠命令列表
export const SLASH_COMMANDS: SlashCommand[] = [
	{
		name: "model",
		description: "Select AI model",
		children: [
			{
				name: "list",
				description: "List configured models",
				action: { type: "internal", handler: "model_list" },
			},
			{
				name: "presets",
				description: "Show available model presets",
				action: { type: "internal", handler: "model_presets" },
			},
			{
				name: "openai",
				description: "OpenAI models",
				children: [
					{
						name: "gpt-4o",
						description: "GPT-4o (recommended)",
						action: { type: "config", key: "model" },
					},
					{
						name: "gpt-4",
						description: "GPT-4",
						action: { type: "config", key: "model" },
					},
					{
						name: "gpt-4-turbo",
						description: "GPT-4 Turbo",
						action: { type: "config", key: "model" },
					},
					{
						name: "gpt-3.5-turbo",
						description: "GPT-3.5 Turbo",
						action: { type: "config", key: "model" },
					},
				],
			},
			{
				name: "qwen",
				description: "Qwen models",
				children: [
					{
						name: "qwen-72b",
						description: "Qwen 72B",
						action: { type: "config", key: "model" },
					},
					{
						name: "qwen-14b",
						description: "Qwen 14B",
						action: { type: "config", key: "model" },
					},
					{
						name: "qwen-7b",
						description: "Qwen 7B",
						action: { type: "config", key: "model" },
					},
				],
			},
			{
				name: "claude",
				description: "Anthropic Claude models",
				children: [
					{
						name: "claude-3-opus",
						description: "Claude 3 Opus",
						action: { type: "config", key: "model" },
					},
					{
						name: "claude-3-sonnet",
						description: "Claude 3 Sonnet",
						action: { type: "config", key: "model" },
					},
					{
						name: "claude-3-haiku",
						description: "Claude 3 Haiku",
						action: { type: "config", key: "model" },
					},
					{
						name: "claude-3.5-sonnet",
						description: "Claude 3.5 Sonnet",
						action: { type: "config", key: "model" },
					},
				],
			},
			{
				name: "deepseek-v3",
				description: "DeepSeek V3",
				action: { type: "config", key: "model" },
			},
			{
				name: "llama-3.3-70b",
				description: "Llama 3.3 70B",
				action: { type: "config", key: "model" },
			},
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
