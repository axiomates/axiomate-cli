import { Box, useApp, useInput } from "ink";
import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import AutocompleteInput from "./components/AutocompleteInput/index.js";
import Divider from "./components/Divider.js";
import Header from "./components/Header.js";
import MessageOutput, { type Message } from "./components/MessageOutput.js";
import useTerminalHeight from "./hooks/useTerminalHeight.js";
import { SLASH_COMMANDS } from "./constants/commands.js";
import { VERSION, APP_NAME } from "./constants/meta.js";
import {
	type UserInput,
	type FileReference,
	isMessageInput,
	isCommandInput,
} from "./models/input.js";
import type { HistoryEntry } from "./models/inputInstance.js";
import {
	handleCommand,
	type CommandCallbacks,
} from "./services/commandHandler.js";
import { getToolRegistry } from "./services/tools/registry.js";
import {
	createAIServiceFromConfig,
	type IAIService,
	type MatchContext,
} from "./services/ai/index.js";
import { buildMessageContent } from "./services/ai/contentBuilder.js";
import {
	MessageQueue,
	type QueuedMessage,
} from "./services/ai/messageQueue.js";
import type { InitResult } from "./utils/init.js";
import { resumeInput } from "./utils/stdin.js";

/**
 * 应用焦点模式
 * - input: 输入模式，↑/↓ 用于历史导航，输入框可用
 * - output: 输出查看模式，↑/↓ 用于滚动消息，输入框禁用
 */
type FocusMode = "input" | "output";

type Props = {
	initResult: InitResult;
};

export default function App({ initResult }: Props) {
	const { exit } = useApp();
	const [messages, setMessages] = useState<Message[]>([]);
	const [focusMode, setFocusMode] = useState<FocusMode>("input");
	const terminalHeight = useTerminalHeight();
	const [inputAreaHeight, setInputAreaHeight] = useState(1);

	// 输入历史记录（提升到 App 组件，避免模式切换时丢失）
	const [inputHistory, setInputHistory] = useState<HistoryEntry[]>([]);
	const handleHistoryChange = useCallback((history: HistoryEntry[]) => {
		setInputHistory(history);
	}, []);

	// AI 加载状态（将来用于显示加载指示器）
	const [, setIsLoading] = useState(false);

	// AI 服务实例（从初始化结果获取）
	const aiServiceRef = useRef<IAIService | null>(initResult.aiService);

	// 消息处理函数（用于消息队列）
	const processMessage = useCallback(
		async (queuedMessage: QueuedMessage): Promise<string> => {
			const aiService = aiServiceRef.current;
			if (!aiService) {
				throw new Error("AI 服务未配置");
			}

			const cwd = process.cwd();

			// 构建消息内容（包含文件）
			const buildResult = await buildMessageContent(
				queuedMessage.content,
				queuedMessage.files,
				aiService.getContextWindow(),
				cwd,
			);

			// 如果有截断提示，显示给用户
			if (buildResult.wasTruncated) {
				setMessages((prev) => [
					...prev,
					{
						content: `⚠️ ${buildResult.truncationNotice}`,
						type: "system" as const,
						markdown: false,
					},
				]);
			}

			// 构建上下文
			const context: MatchContext = {
				cwd,
				selectedFiles: queuedMessage.files.map((f) => f.path),
			};

			// 发送给 AI
			return aiService.sendMessage(buildResult.content, context);
		},
		[],
	);

	// 消息队列实例
	const messageQueueRef = useRef<MessageQueue | null>(null);

	// 初始化消息队列
	useEffect(() => {
		messageQueueRef.current = new MessageQueue(processMessage, {
			onMessageStart: () => {
				setIsLoading(true);
			},
			onMessageComplete: (__, response) => {
				setMessages((prev) => [...prev, { content: response }]);
				setIsLoading(false);
			},
			onMessageError: (__, error) => {
				setMessages((prev) => [
					...prev,
					{ content: `Error: ${error.message}`, markdown: false },
				]);
				setIsLoading(false);
			},
			onQueueEmpty: () => {
				// 队列处理完毕
			},
		});

		return () => {
			messageQueueRef.current?.clear();
		};
	}, [processMessage]);

	// 组件挂载后恢复 stdin 输入（之前在 cli.tsx 中被暂停）
	useEffect(() => {
		resumeInput();
	}, []);

	// 焦点模式切换（Escape 键）
	const toggleFocusMode = useCallback(() => {
		setFocusMode((prev) => (prev === "input" ? "output" : "input"));
	}, []);

	// 输入区域高度变化回调
	const handleInputHeightChange = useCallback((height: number) => {
		setInputAreaHeight(height);
	}, []);

	// 用于从 View 模式注入文本到输入框
	const [injectText, setInjectText] = useState<string>("");
	const handleInjectTextHandled = useCallback(() => {
		setInjectText("");
	}, []);

	// 全局键盘监听（模式切换 + View 模式快捷键）
	useInput(
		(input, key) => {
			// Shift+↑ 或 Shift+↓ 切换焦点模式
			if (key.shift && (key.upArrow || key.downArrow)) {
				toggleFocusMode();
				return;
			}

			// View 模式下按 / 切换到 Input 模式并输入 /
			if (focusMode === "output" && input === "/") {
				setFocusMode("input");
				setInjectText("/");
			}
		},
		{ isActive: true },
	);

	// 发送消息给 AI（支持文件附件）
	const sendToAI = useCallback(
		(content: string, files: FileReference[] = [], isUserMessage = true) => {
			// 显示用户消息
			if (isUserMessage) {
				setMessages((prev) => [...prev, { content, type: "user" }]);
			}

			// 检查 AI 服务是否可用
			if (!aiServiceRef.current) {
				setMessages((prev) => [
					...prev,
					{ content: "AI 服务未配置，请检查 API 设置", markdown: false },
				]);
				return;
			}

			// 检查消息队列是否可用
			if (!messageQueueRef.current) {
				setMessages((prev) => [
					...prev,
					{ content: "消息队列未初始化", markdown: false },
				]);
				return;
			}

			// 加入消息队列（异步处理）
			messageQueueRef.current.enqueue(content, files);
		},
		[],
	);

	// 显示消息（Markdown 渲染）
	const showMessage = useCallback((content: string) => {
		setMessages((prev) => [...prev, { content }]);
	}, []);

	// 更新配置（模型切换现在由 model_select 处理器直接处理）
	const setConfig = useCallback((key: string, value: string) => {
		// 模型切换后需要重新创建 AI 服务
		if (key === "model") {
			const registry = getToolRegistry();
			aiServiceRef.current = createAIServiceFromConfig(registry);
		}
		setMessages((prev) => [...prev, { content: `${key} set to: ${value}` }]);
	}, []);

	// 清屏
	const clearMessages = useCallback(() => {
		setMessages([]);
	}, []);

	// 命令回调集合
	const commandCallbacks: CommandCallbacks = useMemo(
		() => ({
			showMessage,
			sendToAI,
			setConfig,
			clear: clearMessages,
			exit,
		}),
		[showMessage, sendToAI, setConfig, clearMessages, exit],
	);

	const handleSubmit = useCallback(
		async (input: UserInput) => {
			if (isMessageInput(input)) {
				// 发送消息给 AI（带文件附件）
				sendToAI(input.text, input.files);
			} else if (isCommandInput(input)) {
				// 除了 exit 命令，都先显示用户输入（但不发送给 AI）
				const isExit = input.commandPath[0]?.toLowerCase() === "exit";
				if (!isExit) {
					setMessages((prev) => [
						...prev,
						{ content: input.text, type: "user" },
					]);
				}
				await handleCommand(
					input.commandPath,
					{ appName: APP_NAME, version: VERSION },
					commandCallbacks,
				);
			}
		},
		[sendToAI, commandCallbacks],
	);

	const handleClear = useCallback(() => {
		setMessages([]);
	}, []);

	const clearAndExit = useCallback(() => {
		exit();
	}, [exit]);

	// 派生状态
	const isInputMode = focusMode === "input";
	const isOutputMode = focusMode === "output";

	// 计算 MessageOutput 的可用高度
	// 输入模式: Header(1) + Divider(1) + MessageOutput + Divider(1) + InputArea(动态)
	// 浏览模式: Header(1) + Divider(1) + MessageOutput = 2 行固定
	const fixedHeight = isOutputMode ? 2 : 2 + 1 + inputAreaHeight;
	const messageOutputHeight = Math.max(1, terminalHeight - fixedHeight);

	return (
		<Box flexDirection="column" height={terminalHeight}>
			{/* 标题区域 - 固定高度 */}
			<Box flexShrink={0}>
				<Header focusMode={focusMode} />
			</Box>

			{/* 标题与输出区域分隔线 */}
			<Box flexShrink={0}>
				<Divider />
			</Box>

			{/* 输出区域 - 使用计算的固定高度 */}
			<MessageOutput
				messages={messages}
				height={messageOutputHeight}
				focusMode={focusMode}
			/>

			{/* 输出区域与输入框分隔线（仅输入模式显示） */}
			{isInputMode && (
				<Box flexShrink={0}>
					<Divider />
				</Box>
			)}

			{/* 输入框区域（仅输入模式显示） */}
			{isInputMode && (
				<Box flexShrink={0}>
					<AutocompleteInput
						prompt="> "
						onSubmit={handleSubmit}
						onClear={handleClear}
						onExit={clearAndExit}
						slashCommands={SLASH_COMMANDS}
						isActive={isInputMode}
						onHeightChange={handleInputHeightChange}
						injectText={injectText}
						onInjectTextHandled={handleInjectTextHandled}
						history={inputHistory}
						onHistoryChange={handleHistoryChange}
					/>
				</Box>
			)}
		</Box>
	);
}
