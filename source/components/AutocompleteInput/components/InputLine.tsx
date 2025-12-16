/**
 * 输入行渲染组件
 */

import { Box, Text } from "ink";

type InputLineProps = {
	/** 当前行文本 */
	line: string;
	/** 行索引 */
	lineIndex: number;
	/** 是否是第一行 */
	isFirstLine: boolean;
	/** 是否是光标所在行 */
	isCursorLine: boolean;
	/** 光标在当前行的列位置 */
	cursorCol: number;
	/** 建议文本开始位置（-1 表示无建议） */
	suggestionStart: number;
	/** prompt 文本 */
	prompt: string;
	/** prompt 缩进（用于非首行） */
	promptIndent: string;
};

export function InputLine({
	line,
	lineIndex,
	isFirstLine,
	isCursorLine,
	cursorCol,
	suggestionStart,
	prompt,
	promptIndent,
}: InputLineProps) {
	// 拆分行内容：用户输入部分 vs 建议部分
	let userPart = line;
	let suggestPart = "";

	if (suggestionStart >= 0 && suggestionStart < line.length) {
		userPart = line.slice(0, suggestionStart);
		suggestPart = line.slice(suggestionStart);
	}

	return (
		<Box key={`${lineIndex}-${line}`}>
			{/* 第一行显示粉色 prompt，后续行显示等宽空格缩进 */}
			{isFirstLine ? (
				<Text color="#FF69B4">{prompt}</Text>
			) : (
				<Text>{promptIndent}</Text>
			)}
			<Text>
				{isCursorLine ? (
					<CursorLineContent
						userPart={userPart}
						suggestPart={suggestPart}
						cursorCol={cursorCol}
					/>
				) : (
					<>
						{userPart}
						<Text color="gray">{suggestPart}</Text>
					</>
				)}
			</Text>
		</Box>
	);
}

/**
 * 光标所在行的内容渲染
 */
function CursorLineContent({
	userPart,
	suggestPart,
	cursorCol,
}: {
	userPart: string;
	suggestPart: string;
	cursorCol: number;
}) {
	// 光标在用户输入部分
	if (cursorCol < userPart.length) {
		return (
			<>
				{userPart.slice(0, cursorCol)}
				<Text inverse>{userPart[cursorCol]}</Text>
				{userPart.slice(cursorCol + 1)}
				<Text color="gray">{suggestPart}</Text>
			</>
		);
	}

	// 光标在用户输入末尾，有 suggestion
	if (suggestPart.length > 0) {
		return (
			<>
				{userPart}
				<Text inverse>
					<Text color="gray">{suggestPart[0]}</Text>
				</Text>
				<Text color="gray">{suggestPart.slice(1)}</Text>
			</>
		);
	}

	// 光标在末尾，没有 suggestion
	return (
		<>
			{userPart}
			<Text inverse> </Text>
		</>
	);
}
