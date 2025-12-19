import { Box, Text, useInput } from "ink";
import { useState, useCallback, useMemo, useEffect } from "react";
import useTerminalWidth from "../hooks/useTerminalWidth.js";

export type Message = {
	content: string;
	markdown?: boolean; // 是否渲染为 Markdown，默认 true
};

type Props = {
	messages: Message[];
	height: number; // 可用高度（行数）
	isFocused?: boolean; // 是否接收键盘输入（默认 true）
};

// 延迟加载 marked 和 marked-terminal，避免测试环境问题
let markedInstance: {
	parse: (content: string) => string | Promise<string>;
} | null = null;

async function getMarkedInstance(width: number) {
	if (!markedInstance) {
		const { Marked } = await import("marked");
		const { markedTerminal } = await import("marked-terminal");
		const m = new Marked();
		m.use(markedTerminal({ width, reflowText: true }));
		markedInstance = m;
	}
	return markedInstance;
}

// 同步渲染 Markdown（使用缓存的实例）
function renderMarkdownSync(content: string, width: number): string {
	// 如果 marked 还没加载，先返回原始内容
	if (!markedInstance) {
		// 触发异步加载
		getMarkedInstance(width);
		return content;
	}
	const result = markedInstance.parse(content);
	if (typeof result === "string") {
		return result.trim();
	}
	return content;
}

/**
 * 渲染后的行信息
 */
type RenderedLine = {
	text: string;
	msgIndex: number;
};

export default function MessageOutput({
	messages,
	height,
	isFocused = true,
}: Props) {
	const width = useTerminalWidth();
	// scrollOffset: 从底部向上的偏移量（0 = 显示最新消息）
	const [scrollOffset, setScrollOffset] = useState(0);
	// autoScroll: 是否在新消息到达时自动滚动到底部
	const [autoScroll, setAutoScroll] = useState(true);

	// 预加载 marked
	useEffect(() => {
		getMarkedInstance(width);
	}, [width]);

	// 渲染单条消息
	const renderContent = useCallback(
		(msg: Message): string => {
			if (msg.markdown === false) {
				return msg.content;
			}
			return renderMarkdownSync(msg.content, width - 2);
		},
		[width],
	);

	// 将所有消息预渲染为行数组
	const renderedLines: RenderedLine[] = useMemo(() => {
		const lines: RenderedLine[] = [];
		for (let i = 0; i < messages.length; i++) {
			const content = renderContent(messages[i]!);
			const msgLines = content.split("\n");
			for (const line of msgLines) {
				lines.push({ text: line, msgIndex: i });
			}
		}
		return lines;
	}, [messages, renderContent]);

	// 当有新消息且 autoScroll 为 true 时，滚动到底部
	useEffect(() => {
		if (autoScroll) {
			setScrollOffset(0);
		}
	}, [messages.length, autoScroll]);

	// 计算实际可用于内容的高度（减去指示器行）
	const contentHeight = height - 1; // 保留 1 行给指示器

	// 计算可见范围
	const totalLines = renderedLines.length;
	const maxOffset = Math.max(0, totalLines - contentHeight);

	// 确保 scrollOffset 在有效范围内
	const safeOffset = Math.min(Math.max(0, scrollOffset), maxOffset);

	// 计算可见的行
	const startLine = Math.max(0, totalLines - contentHeight - safeOffset);
	const endLine = totalLines - safeOffset;
	const visibleLines = renderedLines.slice(startLine, endLine);

	// 指示器状态
	const hasMoreAbove = startLine > 0;
	const hasMoreBelow = safeOffset > 0;
	const linesAbove = startLine;
	const linesBelow = safeOffset;

	// 键盘控制滚动
	useInput(
		(input, key) => {
			// Shift+↑: 向上滚动
			if (key.upArrow && key.shift) {
				setScrollOffset((prev) => Math.min(prev + 1, maxOffset));
				setAutoScroll(false);
				return;
			}

			// Shift+↓: 向下滚动
			if (key.downArrow && key.shift) {
				const newOffset = Math.max(0, scrollOffset - 1);
				setScrollOffset(newOffset);
				if (newOffset === 0) {
					setAutoScroll(true);
				}
				return;
			}

			// Page Up: 向上滚动一页
			if (key.pageUp) {
				setScrollOffset((prev) => Math.min(prev + contentHeight, maxOffset));
				setAutoScroll(false);
				return;
			}

			// Page Down: 向下滚动一页
			if (key.pageDown) {
				const newOffset = Math.max(0, scrollOffset - contentHeight);
				setScrollOffset(newOffset);
				if (newOffset === 0) {
					setAutoScroll(true);
				}
				return;
			}

			// Shift+Home: 滚动到顶部
			if (key.shift && input === "") {
				// Home key sends empty string with shift
			}

			// Shift+End: 滚动到底部
			if (key.shift && input === "") {
				// End key sends empty string with shift
			}
		},
		{ isActive: isFocused },
	);

	return (
		<Box flexDirection="column" flexGrow={1} overflowY="hidden">
			{/* 顶部指示器 */}
			{hasMoreAbove && (
				<Box justifyContent="center" flexShrink={0}>
					<Text dimColor>↑ 还有 {linesAbove} 行 (Shift+↑ 或 PageUp 滚动)</Text>
				</Box>
			)}

			{/* 消息内容 */}
			<Box
				flexDirection="column"
				flexGrow={1}
				justifyContent={totalLines <= contentHeight ? "flex-end" : "flex-start"}
				overflowY="hidden"
			>
				{visibleLines.map((line, index) => (
					<Box key={`${line.msgIndex}-${index}`} flexShrink={0}>
						<Text>{line.text}</Text>
					</Box>
				))}
			</Box>

			{/* 底部指示器 */}
			{hasMoreBelow && (
				<Box justifyContent="center" flexShrink={0}>
					<Text dimColor>
						↓ 还有 {linesBelow} 行 (Shift+↓ 或 PageDown 滚动)
					</Text>
				</Box>
			)}
		</Box>
	);
}
