/**
 * 命令处理器
 * 根据 SlashCommand 的 action 类型分发处理逻辑
 */

import type {
	SlashCommand,
	CommandAction,
} from "../components/AutocompleteInput/index.js";
import { SLASH_COMMANDS } from "../constants/commands.js";
import { getToolRegistry } from "./tools/registry.js";
import {
	loadAIConfig,
	listConfiguredModels,
	MODEL_PRESETS,
} from "./ai/config.js";

/**
 * 命令执行结果（内部使用）
 */
type CommandResult =
	| { type: "message"; content: string } // 显示消息（内部处理完成）
	| { type: "prompt"; content: string } // 发送给 AI 的 prompt
	| { type: "config"; key: string; value: string } // 配置变更
	| { type: "action"; action: "clear" | "exit" } // 特殊动作
	| { type: "async"; handler: () => Promise<string> } // 异步命令
	| { type: "error"; message: string }; // 错误

/**
 * 内部命令处理器映射
 */
type InternalHandler = (
	path: string[],
	context: CommandContext,
) => CommandResult;

/**
 * 命令执行上下文（静态信息）
 */
export type CommandContext = {
	appName: string;
	version: string;
};

/**
 * 命令执行回调（App 提供的业务逻辑）
 */
export type CommandCallbacks = {
	/** 显示消息 */
	showMessage: (content: string) => void;
	/** 发送给 AI */
	sendToAI: (content: string) => void;
	/** 更新配置 */
	setConfig: (key: string, value: string) => void;
	/** 清屏 */
	clear: () => void;
	/** 退出 */
	exit: () => void;
};

/**
 * 内部命令处理器注册表
 */
const internalHandlers: Record<string, InternalHandler> = {
	help: () => ({
		type: "message",
		content:
			"Available commands: /help, /exit, /clear, /version, /model, /tools, /compact",
	}),

	version: (_path, ctx) => ({
		type: "message",
		content: `${ctx.appName} v${ctx.version}`,
	}),

	clear: () => ({
		type: "action",
		action: "clear",
	}),

	exit: () => ({
		type: "action",
		action: "exit",
	}),

	// 工具命令处理器
	tools_list: () => ({
		type: "async",
		handler: async () => {
			const registry = getToolRegistry();
			if (!registry.isDiscovered) {
				await registry.discover();
			}
			return registry.formatToolList(true);
		},
	}),

	tools_refresh: () => ({
		type: "async",
		handler: async () => {
			const registry = getToolRegistry();
			await registry.discover();
			const stats = registry.getStats();
			return `已重新扫描工具。\n已安装: ${stats.installed} 个\n未安装: ${stats.notInstalled} 个`;
		},
	}),

	tools_stats: () => ({
		type: "async",
		handler: async () => {
			const registry = getToolRegistry();
			if (!registry.isDiscovered) {
				await registry.discover();
			}
			const stats = registry.getStats();
			const lines = [
				`## 工具统计`,
				`- 总计: ${stats.total} 个`,
				`- 已安装: ${stats.installed} 个`,
				`- 未安装: ${stats.notInstalled} 个`,
				``,
				`### 按类别统计（已安装）`,
			];
			for (const [category, count] of Object.entries(stats.byCategory)) {
				lines.push(`- ${category}: ${count} 个`);
			}
			return lines.join("\n");
		},
	}),

	// AI 模型命令处理器
	model_list: () => ({
		type: "message",
		content: (() => {
			const models = listConfiguredModels();
			if (models.length === 0) {
				return "未配置任何模型。使用 `/model <provider> <model>` 设置模型。";
			}

			const lines = ["## 已配置模型", ""];
			for (const { id, config, isCurrent } of models) {
				const marker = isCurrent ? "→ " : "  ";
				const provider = config.provider.toUpperCase();
				lines.push(`${marker}**${id}** (${provider}: ${config.model})`);
			}

			const aiConfig = loadAIConfig();
			lines.push("");
			lines.push(`### 设置`);
			lines.push(`- 两阶段调用: ${aiConfig.twoPhaseEnabled ? "启用" : "禁用"}`);
			lines.push(
				`- 上下文感知: ${aiConfig.contextAwareEnabled ? "启用" : "禁用"}`,
			);
			lines.push(`- 最大工具调用轮数: ${aiConfig.maxToolCallRounds}`);

			return lines.join("\n");
		})(),
	}),

	model_presets: () => ({
		type: "message",
		content: (() => {
			const lines = ["## 可用模型预设", ""];
			const grouped: Record<string, string[]> = {};

			for (const [id, preset] of Object.entries(MODEL_PRESETS)) {
				const provider = preset.provider || "custom";
				if (!grouped[provider]) {
					grouped[provider] = [];
				}
				grouped[provider].push(`  - ${id}`);
			}

			for (const [provider, models] of Object.entries(grouped)) {
				lines.push(`### ${provider.toUpperCase()}`);
				lines.push(...models);
				lines.push("");
			}

			lines.push("使用 `/model <预设名> <API_KEY>` 添加模型配置");

			return lines.join("\n");
		})(),
	}),
};

/**
 * 根据命令路径查找对应的 SlashCommand
 */
export function findCommandByPath(
	path: string[],
	commands: SlashCommand[] = SLASH_COMMANDS,
): SlashCommand | null {
	if (path.length === 0) return null;

	const [first, ...rest] = path;
	const cmd = commands.find((c) => c.name === first);

	if (!cmd) return null;
	if (rest.length === 0) return cmd;
	if (!cmd.children) return null;

	return findCommandByPath(rest, cmd.children);
}

/**
 * 获取命令的 action，支持继承父级 action
 */
export function getCommandAction(
	path: string[],
	commands: SlashCommand[] = SLASH_COMMANDS,
): CommandAction | null {
	const cmd = findCommandByPath(path, commands);
	return cmd?.action ?? null;
}

/**
 * 执行命令（内部）
 */
function executeCommandInternal(
	path: string[],
	context: CommandContext,
	commands: SlashCommand[] = SLASH_COMMANDS,
): CommandResult {
	if (path.length === 0) {
		return { type: "error", message: "Empty command path" };
	}

	const action = getCommandAction(path, commands);

	if (!action) {
		// 没有 action 的命令（可能是分支节点）
		return {
			type: "error",
			message: `Command /${path.join(" ")} has no action`,
		};
	}

	switch (action.type) {
		case "internal": {
			const handler = action.handler ? internalHandlers[action.handler] : null;
			if (!handler) {
				return {
					type: "error",
					message: `Unknown internal handler: ${action.handler}`,
				};
			}
			return handler(path, context);
		}

		case "prompt": {
			return {
				type: "prompt",
				content: action.template,
			};
		}

		case "config": {
			// 对于 model 命令，value 是完整路径（如 "openai gpt-4o"）
			const value = path.slice(1).join(" ");
			return {
				type: "config",
				key: action.key,
				value,
			};
		}

		default:
			return { type: "error", message: "Unknown action type" };
	}
}

/**
 * 执行命令并调用对应的回调
 */
export async function handleCommand(
	path: string[],
	context: CommandContext,
	callbacks: CommandCallbacks,
	commands: SlashCommand[] = SLASH_COMMANDS,
): Promise<void> {
	const result = executeCommandInternal(path, context, commands);

	switch (result.type) {
		case "message":
			callbacks.showMessage(result.content);
			break;

		case "prompt":
			callbacks.sendToAI(result.content);
			break;

		case "config":
			callbacks.setConfig(result.key, result.value);
			break;

		case "action":
			if (result.action === "clear") {
				callbacks.clear();
			} else if (result.action === "exit") {
				callbacks.exit();
			}
			break;

		case "async":
			try {
				const content = await result.handler();
				callbacks.showMessage(content);
			} catch (err) {
				callbacks.showMessage(
					`Error: ${err instanceof Error ? err.message : String(err)}`,
				);
			}
			break;

		case "error":
			callbacks.showMessage(`Error: ${result.message}`);
			break;
	}
}
