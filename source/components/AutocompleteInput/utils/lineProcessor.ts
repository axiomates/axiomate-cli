/**
 * 行处理工具函数
 * 处理手动换行和自动换行的计算逻辑
 */

export type ProcessedLines = {
	/** 处理后的显示行数组 */
	lines: string[];
	/** 每行在原始文本中的起始偏移量 */
	lineOffsets: number[];
	/** 光标所在行索引 */
	cursorLine: number;
	/** 光标所在列索引（显示宽度） */
	cursorCol: number;
	/** 每行宽度 */
	lineWidth: number;
};

export type InputEndInfo = {
	/** 输入文本结束的行索引 */
	endLine: number;
	/** 输入文本结束的列索引（显示宽度） */
	endCol: number;
};

/**
 * 判断字符是否是宽字符（占用2个终端列宽）
 * 包括中文、日文、韩文等CJK字符
 */
export function isWideChar(char: string): boolean {
	const code = char.codePointAt(0);
	if (code === undefined) return false;

	// CJK 统一表意文字
	if (code >= 0x4e00 && code <= 0x9fff) return true;
	// CJK 扩展 A
	if (code >= 0x3400 && code <= 0x4dbf) return true;
	// CJK 扩展 B-F
	if (code >= 0x20000 && code <= 0x2ebef) return true;
	// CJK 兼容表意文字
	if (code >= 0xf900 && code <= 0xfaff) return true;
	// 全角字符
	if (code >= 0xff00 && code <= 0xffef) return true;
	// 日文平假名和片假名
	if (code >= 0x3040 && code <= 0x30ff) return true;
	// 韩文音节
	if (code >= 0xac00 && code <= 0xd7af) return true;
	// 韩文字母
	if (code >= 0x1100 && code <= 0x11ff) return true;
	// 中文标点符号
	if (code >= 0x3000 && code <= 0x303f) return true;

	return false;
}

/**
 * 计算字符的显示宽度
 */
export function getCharWidth(char: string): number {
	return isWideChar(char) ? 2 : 1;
}

/**
 * 计算字符串的显示宽度
 */
export function getStringWidth(str: string): number {
	let width = 0;
	for (const char of str) {
		width += getCharWidth(char);
	}
	return width;
}

/**
 * 将单行文本按显示宽度自动换行
 */
export function wrapLine(text: string, width: number): string[] {
	if (width <= 0 || text.length === 0) return [text];
	const lines: string[] = [];
	let currentLine = "";
	let currentWidth = 0;

	for (const char of text) {
		const charWidth = getCharWidth(char);

		// 如果添加这个字符会超出宽度，先换行
		if (currentWidth + charWidth > width && currentLine.length > 0) {
			lines.push(currentLine);
			currentLine = "";
			currentWidth = 0;
		}

		currentLine += char;
		currentWidth += charWidth;
	}

	// 添加最后一行
	if (currentLine.length > 0 || lines.length === 0) {
		lines.push(currentLine);
	}

	return lines;
}

/**
 * 处理手动换行 + 自动换行
 * 返回显示行数组和光标位置信息
 */
export function processLines(
	displayText: string,
	suggestionText: string,
	cursorPos: number,
	columns: number,
	promptLength: number,
): ProcessedLines {
	const lineWidth =
		columns - promptLength > 0 ? columns - promptLength : columns;
	const fullText = displayText + suggestionText;

	// 先按手动换行符分割
	const manualLines = fullText.split("\n");
	const allLines: string[] = [];
	const lineOffsets: number[] = [];

	// 记录每个手动行的起始位置（用于计算光标位置）
	let charCount = 0;
	let cursorLine = 0;
	let cursorCol = 0;
	let foundCursor = false;

	for (let i = 0; i < manualLines.length; i++) {
		const manualLine = manualLines[i]!;
		const wrappedLines = wrapLine(manualLine, lineWidth);

		for (let j = 0; j < wrappedLines.length; j++) {
			const line = wrappedLines[j]!;
			const lineStart = charCount;

			// 记录该行在原始文本中的起始偏移
			lineOffsets.push(lineStart);

			// 计算光标位置
			if (!foundCursor) {
				const lineEnd = charCount + line.length;

				if (cursorPos >= lineStart && cursorPos <= lineEnd) {
					cursorLine = allLines.length;
					// 光标列位置需要计算到光标位置的显示宽度
					const charsBeforeCursor = line.slice(0, cursorPos - lineStart);
					cursorCol = getStringWidth(charsBeforeCursor);
					foundCursor = true;
				}
			}

			allLines.push(line);
			charCount += line.length;
		}

		// 手动换行符也占一个字符位置
		if (i < manualLines.length - 1) {
			charCount += 1; // \n
		}
	}

	// 如果没找到光标（光标在末尾），设置到最后
	if (!foundCursor) {
		cursorLine = allLines.length - 1;
		const lastLine = allLines[cursorLine] || "";
		cursorCol = getStringWidth(lastLine);
	}

	return { lines: allLines, lineOffsets, cursorLine, cursorCol, lineWidth };
}

/**
 * 计算输入文本在哪一行结束（用于显示建议）
 */
export function getInputEndInfo(
	displayText: string,
	lineWidth: number,
): InputEndInfo {
	const manualLines = displayText.split("\n");
	let totalLines = 0;
	let lastLineWidth = 0;

	for (const manualLine of manualLines) {
		// 使用 wrapLine 来获取正确的换行结果
		const wrappedLines = wrapLine(manualLine, lineWidth);
		totalLines += wrappedLines.length;
		// 最后一个换行后的行的显示宽度
		const lastWrappedLine = wrappedLines[wrappedLines.length - 1] || "";
		lastLineWidth = getStringWidth(lastWrappedLine);
	}

	return {
		endLine: totalLines - 1,
		endCol: lastLineWidth,
	};
}
