declare module "ink-testing-library" {
	import type { ReactElement } from "react";

	/**
	 * 模拟的 stdout 流
	 */
	export interface Stdout {
		/** 终端列数，固定为 100 */
		readonly columns: number;
		/** 所有渲染的帧 */
		frames: string[];
		/** 写入一帧 */
		write: (frame: string) => void;
		/** 获取最后一帧 */
		lastFrame: () => string | undefined;
	}

	/**
	 * 模拟的 stderr 流
	 */
	export interface Stderr {
		/** 所有渲染的帧 */
		frames: string[];
		/** 写入一帧 */
		write: (frame: string) => void;
		/** 获取最后一帧 */
		lastFrame: () => string | undefined;
	}

	/**
	 * 模拟的 stdin 流
	 */
	export interface Stdin {
		/** 是否为 TTY */
		isTTY: boolean;
		/** 模拟用户输入 */
		write: (data: string) => void;
		/** 读取输入 */
		read: () => string | null;
	}

	/**
	 * render() 函数的返回值
	 */
	export interface RenderResult {
		/** 用新的组件树重新渲染 */
		rerender: (tree: ReactElement) => void;
		/** 卸载组件 */
		unmount: () => void;
		/** 清理资源 */
		cleanup: () => void;
		/** 模拟的 stdout */
		stdout: Stdout;
		/** 模拟的 stderr */
		stderr: Stderr;
		/** 模拟的 stdin */
		stdin: Stdin;
		/** stdout 的所有帧（快捷方式） */
		frames: string[];
		/** 获取 stdout 最后一帧（快捷方式） */
		lastFrame: () => string | undefined;
	}

	/**
	 * 渲染一个 Ink 组件用于测试
	 * @param tree - React 元素
	 * @returns 渲染结果，包含控制方法和模拟的 IO 流
	 */
	export function render(tree: ReactElement): RenderResult;

	/**
	 * 清理所有渲染实例
	 * 通常在测试的 afterEach 中调用
	 */
	export function cleanup(): void;
}
