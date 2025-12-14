import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

const CONFIG_FILENAME = ".axiomate.json";

export type Config = Record<string, unknown>;

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
export function loadConfig(): Config {
	const configPath = getConfigPath();

	try {
		if (fs.existsSync(configPath)) {
			const content = fs.readFileSync(configPath, "utf-8");
			const config = JSON.parse(content) as Config;

			// 验证是否为对象类型
			if (config === null || typeof config !== "object" || Array.isArray(config)) {
				throw new Error("Config must be an object");
			}

			return config;
		}
	} catch {
		// 文件读取失败或 JSON 格式不正确，将在下面创建新的空配置文件
	}

	// 文件不存在或读取失败，创建空配置文件
	const emptyConfig: Config = {};
	saveConfig(emptyConfig);
	return emptyConfig;
}

/**
 * 保存配置到文件
 */
export function saveConfig(config: Config): void {
	const configPath = getConfigPath();
	fs.writeFileSync(configPath, JSON.stringify(config, null, 4), "utf-8");
}
