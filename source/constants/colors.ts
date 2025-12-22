/**
 * 颜色常量定义
 * 用于输入框和菜单的颜色渲染
 */

/** 路径名颜色（金黄色） - 用于命令路径和目录名 */
export const PATH_COLOR = "#ffd700";

/** 箭头/分隔符颜色（灰色） - 用于 → 和 \ */
export const ARROW_COLOR = "gray";

/** 文件 @ 符号颜色（浅蓝色） */
export const FILE_AT_COLOR = "#87ceeb";

/** 文件颜色（浅蓝色） - 用于 FileMenu */
export const FILE_COLOR = "#87ceeb";

/** 目录颜色（金黄色） - 用于 FileMenu */
export const DIR_COLOR = "#ffd700";

/** 主题浅黄色 - 用于快捷键提示等 */
export const THEME_LIGHT_YELLOW = "#ffff00";

/** 主题粉色 - 用于应用名称等 */
export const THEME_PINK = "#ff69b4";

/** 光标指示符颜色 - 青色，醒目且不与其他颜色冲突 */
export const CURSOR_COLOR = "#00ffff";

/**
 * 将颜色变浅（用于光标背景）
 * 输入 hex 颜色（如 #ff69b4），返回更浅的版本
 * @param color 原始颜色（hex 格式或颜色名）
 * @param factor 变浅因子（0-1，越大越浅，默认 0.4）
 */
export function lightenColor(color: string, factor: number = 0.4): string {
	// 如果是颜色名，使用预定义映射
	const namedColors: Record<string, string> = {
		gray: "#808080",
		white: "#ffffff",
		black: "#000000",
		red: "#ff0000",
		green: "#00ff00",
		blue: "#0000ff",
		yellow: "#ffff00",
		cyan: "#00ffff",
		magenta: "#ff00ff",
	};

	let hex = color;
	if (!color.startsWith("#")) {
		hex = namedColors[color.toLowerCase()] || "#808080";
	}

	// 解析 hex 颜色
	const r = parseInt(hex.slice(1, 3), 16);
	const g = parseInt(hex.slice(3, 5), 16);
	const b = parseInt(hex.slice(5, 7), 16);

	// 向白色混合（变浅）
	const newR = Math.round(r + (255 - r) * factor);
	const newG = Math.round(g + (255 - g) * factor);
	const newB = Math.round(b + (255 - b) * factor);

	return `#${newR.toString(16).padStart(2, "0")}${newG.toString(16).padStart(2, "0")}${newB.toString(16).padStart(2, "0")}`;
}
