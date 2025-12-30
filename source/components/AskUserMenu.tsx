/**
 * AskUserMenu component
 * Displays a question with predefined options and custom input option
 * Used when AI invokes the ask_user tool
 *
 * 参考 SlashMenu 的实现方式，使用纯展示 + 独立键盘处理
 * 自定义输入模式支持多行编辑（Ctrl+Enter 换行，上下键导航行）
 */

import { useState, useCallback, useMemo } from "react";
import { Box, Text, useInput } from "ink";
import { t } from "../i18n/index.js";

type AskUserMenuProps = {
	/** The question to display */
	question: string;
	/** Predefined options */
	options: string[];
	/** Callback when user selects an option or enters custom input */
	onSelect: (answer: string) => void;
	/** Callback when user cancels (Escape) */
	onCancel?: () => void;
	/** Terminal width */
	columns: number;
	/** Callback when custom input mode changes */
	onCustomInputModeChange?: (isCustomInput: boolean) => void;
};

export function AskUserMenu({
	question,
	options,
	onSelect,
	onCancel,
	columns,
	onCustomInputModeChange,
}: AskUserMenuProps) {
	// Limit to max 3 options + custom input
	const limitedOptions = options.slice(0, 3);
	const customInputLabel = t("askUser.customInput");
	const allOptions = limitedOptions.length > 0
		? [...limitedOptions, customInputLabel]
		: [customInputLabel];

	const [selectedIndex, setSelectedIndex] = useState(0);
	const [isCustomInputMode, setIsCustomInputMode] = useState(false);
	const [customInputValue, setCustomInputValue] = useState("");
	const [cursor, setCursor] = useState(0); // 光标位置

	// Handle option selection
	const handleSelect = useCallback(() => {
		if (selectedIndex === allOptions.length - 1) {
			// User selected "Custom input..."
			setIsCustomInputMode(true);
			onCustomInputModeChange?.(true);
		} else {
			// User selected a predefined option
			onSelect(limitedOptions[selectedIndex] ?? "");
		}
	}, [selectedIndex, allOptions.length, limitedOptions, onSelect, onCustomInputModeChange]);

	// Handle custom input submit
	const handleCustomInputSubmit = useCallback(() => {
		if (customInputValue.trim()) {
			onSelect(customInputValue.trim());
		}
	}, [customInputValue, onSelect]);

	// Handle custom input cancel (back to options)
	const handleCustomInputCancel = useCallback(() => {
		setIsCustomInputMode(false);
		setCustomInputValue("");
		setCursor(0);
		onCustomInputModeChange?.(false);
	}, [onCustomInputModeChange]);

	// 计算多行信息（行数组、当前行索引、行内光标位置）
	const lineInfo = useMemo(() => {
		const lines = customInputValue.split("\n");
		let charCount = 0;
		let currentLineIndex = 0;
		let cursorCol = cursor;

		for (let i = 0; i < lines.length; i++) {
			const lineLength = lines[i]!.length;
			if (cursor <= charCount + lineLength) {
				currentLineIndex = i;
				cursorCol = cursor - charCount;
				break;
			}
			charCount += lineLength + 1; // +1 for newline
		}

		return { lines, currentLineIndex, cursorCol };
	}, [customInputValue, cursor]);

	// 计算给定行索引的起始字符位置
	const getLineStartPosition = useCallback((lineIndex: number, lines: string[]) => {
		let pos = 0;
		for (let i = 0; i < lineIndex; i++) {
			pos += lines[i]!.length + 1; // +1 for newline
		}
		return pos;
	}, []);

	// Keyboard input handling
	useInput(
		(input, key) => {
			if (isCustomInputMode) {
				const { lines, currentLineIndex, cursorCol } = lineInfo;

				// Escape - 返回选项列表
				if (key.escape) {
					handleCustomInputCancel();
					return;
				}

				// Ctrl+Enter - 插入换行
				if (key.ctrl && key.return) {
					const newValue = customInputValue.slice(0, cursor) + "\n" + customInputValue.slice(cursor);
					setCustomInputValue(newValue);
					setCursor(cursor + 1);
					return;
				}

				// Enter - 提交
				if (key.return) {
					handleCustomInputSubmit();
					return;
				}

				// 上箭头 - 移动到上一行
				if (key.upArrow) {
					if (currentLineIndex > 0) {
						const prevLineIndex = currentLineIndex - 1;
						const prevLine = lines[prevLineIndex]!;
						// 尝试保持相同的列位置，但不超过上一行的长度
						const newCol = Math.min(cursorCol, prevLine.length);
						const newCursor = getLineStartPosition(prevLineIndex, lines) + newCol;
						setCursor(newCursor);
					}
					return;
				}

				// 下箭头 - 移动到下一行
				if (key.downArrow) {
					if (currentLineIndex < lines.length - 1) {
						const nextLineIndex = currentLineIndex + 1;
						const nextLine = lines[nextLineIndex]!;
						// 尝试保持相同的列位置，但不超过下一行的长度
						const newCol = Math.min(cursorCol, nextLine.length);
						const newCursor = getLineStartPosition(nextLineIndex, lines) + newCol;
						setCursor(newCursor);
					}
					return;
				}

				// 左箭头 - 光标左移
				if (key.leftArrow) {
					if (cursor > 0) {
						setCursor(cursor - 1);
					}
					return;
				}

				// 右箭头 - 光标右移
				if (key.rightArrow) {
					if (cursor < customInputValue.length) {
						setCursor(cursor + 1);
					}
					return;
				}

				// Backspace - 删除光标前的字符
				if (key.backspace || key.delete) {
					// Windows 上 backspace 可能触发 key.delete，通过检查 input 区分
					const isBackspace =
						key.backspace ||
						(key.delete &&
							(input === "" || input === "\b" || input === "\x7f"));

					if (isBackspace && cursor > 0) {
						const newValue = customInputValue.slice(0, cursor - 1) + customInputValue.slice(cursor);
						setCustomInputValue(newValue);
						setCursor(cursor - 1);
					}
					return;
				}

				// Ctrl+A - 移动到行首
				if (key.ctrl && input === "a") {
					const lineStart = getLineStartPosition(currentLineIndex, lines);
					setCursor(lineStart);
					return;
				}

				// Ctrl+E - 移动到行尾
				if (key.ctrl && input === "e") {
					const lineStart = getLineStartPosition(currentLineIndex, lines);
					const lineEnd = lineStart + lines[currentLineIndex]!.length;
					setCursor(lineEnd);
					return;
				}

				// 普通字符输入
				if (input && !key.ctrl && !key.meta) {
					const newValue = customInputValue.slice(0, cursor) + input + customInputValue.slice(cursor);
					setCustomInputValue(newValue);
					setCursor(cursor + input.length);
				}
				return;
			}

			// Navigation in options list
			if (key.upArrow) {
				setSelectedIndex((i) =>
					i === 0 ? allOptions.length - 1 : i - 1,
				);
			} else if (key.downArrow) {
				setSelectedIndex((i) =>
					i === allOptions.length - 1 ? 0 : i + 1,
				);
			} else if (key.return) {
				handleSelect();
			} else if (key.escape) {
				onCancel?.();
			}
		},
		{ isActive: true },
	);

	return (
		<Box flexDirection="column">
			{/* Divider */}
			<Text color="gray">{"─".repeat(columns)}</Text>

			{/* Question */}
			<Box>
				<Text color="cyan" bold>? {question}</Text>
			</Box>

			{isCustomInputMode ? (
				/* Custom input mode - 支持多行 */
				<Box flexDirection="column">
					{lineInfo.lines.map((line, lineIndex) => {
						const isCursorLine = lineIndex === lineInfo.currentLineIndex;
						return (
							<Box key={lineIndex}>
								<Text color="gray">{lineIndex === 0 ? "  > " : "    "}</Text>
								{isCursorLine ? (
									<>
										<Text>{line.slice(0, lineInfo.cursorCol)}</Text>
										<Text inverse>{line[lineInfo.cursorCol] ?? " "}</Text>
										<Text>{line.slice(lineInfo.cursorCol + 1)}</Text>
									</>
								) : (
									<Text>{line}</Text>
								)}
							</Box>
						);
					})}
				</Box>
			) : (
				/* Options list (max 4: 3 options + custom input) */
				<>
					{allOptions.map((option, index) => {
						const isSelected = index === selectedIndex;
						const isCustomOption = index === allOptions.length - 1;

						return (
							<Box key={index}>
								<Text
									backgroundColor={isSelected ? "blue" : undefined}
									color={isSelected ? "white" : isCustomOption ? "gray" : undefined}
								>
									{"  "}
									{isSelected ? "▸ " : "  "}
									{option}
								</Text>
							</Box>
						);
					})}
				</>
			)}

			{/* Hints */}
			<Box>
				<Text dimColor>
					{isCustomInputMode
						? t("askUser.customInputHint")
						: t("askUser.navigationHint")}
				</Text>
			</Box>
		</Box>
	);
}
