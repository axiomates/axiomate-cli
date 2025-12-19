/**
 * 工具发现基础设施
 * 提供跨平台的工具检测、版本获取等功能
 */

import { spawnSync } from "node:child_process";
import { platform } from "node:os";
import { existsSync } from "node:fs";
import type { DiscoveredTool, ToolDefinition } from "../types.js";

const isWindows = platform() === "win32";

/**
 * 检测命令是否存在
 */
export function commandExists(cmd: string): boolean {
	try {
		const result = spawnSync(isWindows ? "where" : "which", [cmd], {
			stdio: "pipe",
			windowsHide: true,
			encoding: "utf-8",
		});
		return result.status === 0;
	} catch {
		return false;
	}
}

/**
 * 获取可执行文件的完整路径
 */
export function getExecutablePath(cmd: string): string | null {
	try {
		const result = spawnSync(isWindows ? "where" : "which", [cmd], {
			stdio: "pipe",
			windowsHide: true,
			encoding: "utf-8",
		});
		if (result.status === 0 && result.stdout) {
			// where 在 Windows 可能返回多行，取第一行
			const lines = result.stdout.trim().split(/\r?\n/);
			return lines[0] || null;
		}
	} catch {
		// ignore
	}
	return null;
}

/**
 * 执行命令获取版本信息
 */
export function getVersion(
	cmd: string,
	args: string[] = ["--version"],
	options?: {
		parseOutput?: (output: string) => string;
		useStderr?: boolean; // java -version 输出到 stderr
	},
): string | null {
	try {
		const result = spawnSync(cmd, args, {
			stdio: "pipe",
			windowsHide: true,
			encoding: "utf-8",
			timeout: 5000,
		});

		const output = options?.useStderr ? result.stderr : result.stdout;
		if (output) {
			const trimmed = output.trim();
			if (options?.parseOutput) {
				return options.parseOutput(trimmed);
			}
			// 默认取第一行
			return trimmed.split(/\r?\n/)[0] || null;
		}
	} catch {
		// ignore
	}
	return null;
}

/**
 * 检查文件是否存在
 */
export function fileExists(path: string): boolean {
	return existsSync(path);
}

/**
 * Windows 注册表查询
 */
export function queryRegistry(
	keyPath: string,
	valueName?: string,
): string | null {
	if (!isWindows) return null;

	try {
		const args = ["query", keyPath];
		if (valueName) {
			args.push("/v", valueName);
		}

		const result = spawnSync("reg", args, {
			stdio: "pipe",
			windowsHide: true,
			encoding: "utf-8",
		});

		if (result.status === 0 && result.stdout) {
			// 解析 reg query 输出
			const lines = result.stdout.split(/\r?\n/);
			for (const line of lines) {
				if (valueName) {
					// 查找特定值
					if (line.includes(valueName)) {
						const match = line.match(/REG_\w+\s+(.+)$/);
						if (match) {
							return match[1].trim();
						}
					}
				} else {
					// 返回默认值
					if (line.includes("(Default)")) {
						const match = line.match(/REG_\w+\s+(.+)$/);
						if (match) {
							return match[1].trim();
						}
					}
				}
			}
		}
	} catch {
		// ignore
	}
	return null;
}

/**
 * 使用 vswhere.exe 查找 Visual Studio 安装
 */
export function findVisualStudio(): {
	installPath: string;
	version: string;
	productId: string;
} | null {
	if (!isWindows) return null;

	// vswhere.exe 的常见位置
	const vswherePaths = [
		"C:\\Program Files (x86)\\Microsoft Visual Studio\\Installer\\vswhere.exe",
		"C:\\Program Files\\Microsoft Visual Studio\\Installer\\vswhere.exe",
	];

	let vswherePath: string | null = null;
	for (const p of vswherePaths) {
		if (fileExists(p)) {
			vswherePath = p;
			break;
		}
	}

	if (!vswherePath) {
		// 尝试在 PATH 中查找
		const pathResult = getExecutablePath("vswhere");
		if (pathResult) {
			vswherePath = pathResult;
		}
	}

	if (!vswherePath) return null;

	try {
		const result = spawnSync(
			vswherePath,
			["-latest", "-format", "json", "-utf8"],
			{
				stdio: "pipe",
				windowsHide: true,
				encoding: "utf-8",
			},
		);

		if (result.status === 0 && result.stdout) {
			const data = JSON.parse(result.stdout);
			if (Array.isArray(data) && data.length > 0) {
				const vs = data[0];
				return {
					installPath: vs.installationPath,
					version: vs.installationVersion,
					productId: vs.productId,
				};
			}
		}
	} catch {
		// ignore
	}
	return null;
}

/**
 * 创建未安装的工具对象
 */
export function createNotInstalledTool(
	definition: ToolDefinition,
): DiscoveredTool {
	return {
		...definition,
		executablePath: "",
		installed: false,
	};
}

/**
 * 创建已安装的工具对象
 */
export function createInstalledTool(
	definition: ToolDefinition,
	executablePath: string,
	version?: string,
): DiscoveredTool {
	return {
		...definition,
		executablePath,
		version,
		installed: true,
	};
}
