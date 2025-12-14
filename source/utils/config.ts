import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

const CONFIG_FILENAME = ".axiomate.json";

/**
 * 运行时配置（已合并默认值）
 */
export type Config = {
	AXIOMATE_BASE_URL: string;
	AXIOMATE_API_KEY: string;
};

/**
 * 配置文件的结构（所有字段可选）
 */
export type ConfigFile = Partial<Config>;

// 默认配置
const DEFAULT_CONFIG: Config = {
	AXIOMATE_BASE_URL: "https://api.axiomate.net",
	AXIOMATE_API_KEY: "",
};

// 运行时配置（单例）
let runtimeConfig: Config | null = null;

/**
 * 获取用户主目录下的配置文件路径
 * 跨平台兼容：Windows 使用 C:\Users\%USERNAME%，Unix 使用 ~
 */
export function getConfigPath(): string {
	const homeDir = os.homedir();
	return path.join(homeDir, CONFIG_FILENAME);
}

/**
 * 读取配置文件，如果不存在或格式不正确则创建空配置文件
 */
function loadConfigFile(): ConfigFile {
	const configPath = getConfigPath();

	try {
		if (fs.existsSync(configPath)) {
			const content = fs.readFileSync(configPath, "utf-8");
			const config = JSON.parse(content) as ConfigFile;

			// 验证是否为对象类型
			if (
				config === null ||
				typeof config !== "object" ||
				Array.isArray(config)
			) {
				throw new Error("Config must be an object");
			}

			return config;
		}
	} catch {
		// 文件读取失败或 JSON 格式不正确，将在下面创建新的空配置文件
	}

	// 文件不存在或读取失败，创建空配置文件
	const emptyConfig: ConfigFile = {};
	saveConfigFile(emptyConfig);
	return emptyConfig;
}

/**
 * 保存配置到文件
 */
function saveConfigFile(config: ConfigFile): void {
	const configPath = getConfigPath();
	fs.writeFileSync(configPath, JSON.stringify(config, null, 4), "utf-8");
}

/**
 * 初始化配置（合并文件配置和默认配置）
 */
export function initConfig(): Config {
	const fileConfig = loadConfigFile();
	runtimeConfig = {
		...DEFAULT_CONFIG,
		...fileConfig,
	};
	return runtimeConfig;
}

/**
 * 获取当前配置（如果未初始化则自动初始化）
 */
export function getConfig(): Config {
	if (runtimeConfig === null) {
		return initConfig();
	}
	return runtimeConfig;
}

/**
 * 更新配置并保存到文件
 */
export function updateConfig(updates: Partial<Config>): Config {
	const currentConfig = getConfig();
	const newConfig: Config = {
		...currentConfig,
		...updates,
	};
	runtimeConfig = newConfig;
	saveConfigFile(newConfig);
	return newConfig;
}
