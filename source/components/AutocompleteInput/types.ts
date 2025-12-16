/**
 * AutocompleteInput 类型定义
 */

import type { UserInput } from "../../models/input.js";

// 重新导出 UserInput 相关类型
export type { UserInput };
export { isMessageInput, isCommandInput } from "../../models/input.js";

/**
 * 斜杠命令类型（支持递归嵌套）
 */
export type SlashCommand = {
	name: string;
	description?: string;
	children?: SlashCommand[];
};

/**
 * 输入模式 - 互斥状态机
 * - normal: 普通输入模式（带自动补全）
 * - history: 历史浏览模式（上下键浏览历史记录）
 * - slash: 斜杠命令选择模式（支持多层级，path 记录选择路径）
 * - help: 快捷键帮助模式
 */
export type InputMode =
	| { type: "normal" }
	| { type: "history"; index: number; savedInput: string }
	| { type: "slash"; path: string[]; selectedIndex: number }
	| { type: "help" };

/**
 * 统一的输入状态
 */
export type InputState = {
	input: string;
	cursor: number;
	suggestion: string | null;
	mode: InputMode;
};

/**
 * Reducer Action 类型
 */
export type InputAction =
	| { type: "SET_INPUT"; input: string; cursor: number }
	| { type: "SET_CURSOR"; cursor: number }
	| { type: "SET_SUGGESTION"; suggestion: string | null }
	| {
			type: "ENTER_HISTORY";
			index: number;
			savedInput: string;
			historyInput: string;
	  }
	| { type: "NAVIGATE_HISTORY"; index: number; historyInput: string }
	| { type: "EXIT_HISTORY" }
	| { type: "SELECT_SLASH"; index: number }
	| { type: "ENTER_SLASH_LEVEL"; name: string }
	| { type: "EXIT_SLASH_LEVEL" }
	| { type: "EXIT_SLASH" }
	| { type: "TOGGLE_HELP" }
	| { type: "RESET" };

/**
 * AutocompleteInput 组件 Props
 */
export type AutocompleteInputProps = {
	prompt?: string;
	/** 用户输入提交回调，提供结构化的输入信息 */
	onSubmit?: (input: UserInput) => void;
	onClear?: () => void;
	onExit?: () => void;
	slashCommands?: SlashCommand[];
};

// ============================================================================
// 模式判断 Helper 函数
// ============================================================================

export const isNormalMode = (mode: InputMode): mode is { type: "normal" } =>
	mode.type === "normal";

export const isHistoryMode = (
	mode: InputMode,
): mode is { type: "history"; index: number; savedInput: string } =>
	mode.type === "history";

export const isSlashMode = (
	mode: InputMode,
): mode is { type: "slash"; path: string[]; selectedIndex: number } =>
	mode.type === "slash";

export const isHelpMode = (mode: InputMode): mode is { type: "help" } =>
	mode.type === "help";
