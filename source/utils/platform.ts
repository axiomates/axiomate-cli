/**
 * 平台相关初始化
 *
 * 处理平台特定的配置和行为：
 * - Windows Terminal profile 自动配置
 * - 配置更新后自动重启（保持工作目录）
 */

import { spawn } from "child_process";
import { copyFileSync, existsSync, readFileSync, writeFileSync } from "fs";
import { platform } from "os";
import { join } from "path";

// ============================================================================
// Windows Terminal 配置
// ============================================================================

const TERMINAL_SETTINGS_PATHS = [
	// 稳定版 (Microsoft Store)
	join(
		process.env.LOCALAPPDATA || "",
		"Packages",
		"Microsoft.WindowsTerminal_8wekyb3d8bbwe",
		"LocalState",
		"settings.json",
	),
	// 预览版 (Microsoft Store)
	join(
		process.env.LOCALAPPDATA || "",
		"Packages",
		"Microsoft.WindowsTerminalPreview_8wekyb3d8bbwe",
		"LocalState",
		"settings.json",
	),
	// 未打包版本 (scoop, chocolatey, etc.)
	join(
		process.env.LOCALAPPDATA || "",
		"Microsoft",
		"Windows Terminal",
		"settings.json",
	),
];

const PROFILE_GUID = "{a010a7e0-c110-4a99-b07b-9f0f11e00000}";
const PROFILE_NAME = "axiomate-cli";

// 旧版本使用的无效 GUID，用于迁移
const LEGACY_GUIDS = [
	"{a]x1om4te-c1i0-4app-b0th-pr0f1leguid0}",
	"{ax10ma7e-c110-4a99-b07b-9f0f11e00000}",
];

type TerminalProfile = {
	guid: string;
	name: string;
	commandline: string;
	icon: string;
	hidden?: boolean;
	[key: string]: unknown;
};

type TerminalSettings = {
	profiles?: {
		list?: TerminalProfile[];
		[key: string]: unknown;
	};
	[key: string]: unknown;
};

// ============================================================================
// 内部辅助函数
// ============================================================================

function isPackagedExe(): boolean {
	return (
		!process.execPath.endsWith("node.exe") && !process.execPath.endsWith("node")
	);
}

function findSettingsPath(): string | null {
	for (const path of TERMINAL_SETTINGS_PATHS) {
		if (existsSync(path)) {
			return path;
		}
	}
	return null;
}

function parseJsonWithComments(content: string): TerminalSettings {
	// 移除单行注释 // ...
	const noSingleLineComments = content.replace(/^\s*\/\/.*$/gm, "");
	// 移除行尾注释 (小心不要移除 URL 中的 //)
	const noTrailingComments = noSingleLineComments.replace(
		/([^:])\/\/.*$/gm,
		"$1",
	);
	// 移除多行注释 /* ... */
	const noComments = noTrailingComments.replace(/\/\*[\s\S]*?\*\//g, "");
	// 移除尾随逗号 (JSON5 风格)
	const noTrailingCommas = noComments.replace(/,(\s*[}\]])/g, "$1");

	return JSON.parse(noTrailingCommas);
}

function isProfileUpToDate(profile: TerminalProfile, exePath: string): boolean {
	return (
		profile.guid === PROFILE_GUID &&
		profile.commandline === exePath &&
		profile.icon === exePath // icon 使用 exe 路径
	);
}

/**
 * 确保 Windows Terminal profile 配置正确
 * @returns true 如果配置被更新，需要重启
 */
function ensureWindowsTerminalProfile(): boolean {
	const settingsPath = findSettingsPath();
	if (!settingsPath) {
		return false;
	}

	try {
		const content = readFileSync(settingsPath, "utf-8");
		const settings = parseJsonWithComments(content);

		// 确保 profiles.list 存在
		if (!settings.profiles) {
			settings.profiles = { list: [] };
		}
		if (!settings.profiles.list) {
			settings.profiles.list = [];
		}
		const profileList = settings.profiles.list;

		const exePath = process.execPath;

		// 查找现有 profile（包括旧版本的无效 GUID）
		const existingProfile = profileList.find(
			(p) =>
				p.guid === PROFILE_GUID ||
				p.name === PROFILE_NAME ||
				LEGACY_GUIDS.includes(p.guid),
		);

		// 如果已存在且配置正确，无需更新
		if (existingProfile && isProfileUpToDate(existingProfile, exePath)) {
			return false;
		}

		// 需要添加或更新
		const newProfile: TerminalProfile = {
			guid: PROFILE_GUID,
			name: PROFILE_NAME,
			commandline: exePath,
			icon: exePath,
		};

		if (existingProfile) {
			const index = profileList.indexOf(existingProfile);
			profileList[index] = { ...existingProfile, ...newProfile };
		} else {
			profileList.push(newProfile);
		}

		// 备份并写入
		copyFileSync(settingsPath, settingsPath + ".backup");
		writeFileSync(settingsPath, JSON.stringify(settings, null, 4), "utf-8");

		return true;
	} catch {
		return false;
	}
}

/**
 * 使用 Windows Terminal 重启应用（保持工作目录和命令行参数）
 */
function restartWithWindowsTerminal(): never {
	const cwd = process.cwd();
	const exePath = process.execPath;
	// 获取原始命令行参数（排除 exe 路径本身）
	const args = process.argv.slice(1);

	spawn("wt.exe", ["-d", cwd, exePath, ...args], {
		detached: true,
		stdio: "ignore",
	}).unref();

	process.exit(0);
}

// ============================================================================
// 公开 API
// ============================================================================

/**
 * 平台初始化
 *
 * 在 Windows 上：
 * - 自动配置 Windows Terminal profile
 * - 如果配置更新了，自动重启以应用新配置（保持工作目录）
 *
 * 在其他平台上：
 * - 无操作
 *
 * 注意：如果需要重启，此函数不会返回（调用 process.exit）
 */
export function initPlatform(): void {
	// 仅 Windows 打包后的 exe 执行
	if (platform() !== "win32" || !isPackagedExe()) {
		return;
	}

	const needsRestart = ensureWindowsTerminalProfile();

	if (needsRestart) {
		restartWithWindowsTerminal();
	}
}
