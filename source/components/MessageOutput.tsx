import { Box, Text } from "ink";
import { useCallback } from "react";
import useTerminalWidth from "../hooks/useTerminalWidth.js";

export type Message = {
	content: string;
	markdown?: boolean; // 是否渲染为 Markdown，默认 true
};

type Props = {
	messages: Message[];
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

export default function MessageOutput({ messages }: Props) {
	const width = useTerminalWidth();

	const renderContent = useCallback(
		(msg: Message): string => {
			if (msg.markdown === false) {
				return msg.content;
			}
			return renderMarkdownSync(msg.content, width - 2);
		},
		[width],
	);

	return (
		<Box
			flexDirection="column"
			flexGrow={1}
			justifyContent="flex-end"
			overflowY="hidden"
		>
			{messages.map((msg, index) => (
				<Box key={index} flexShrink={0}>
					<Text>{renderContent(msg)}</Text>
				</Box>
			))}
		</Box>
	);
}
