/**
 * 构建时生成应用元信息文件
 * 从 package.json 读取信息，写入 source/constants/meta.ts
 * 从 .env.local 读取 API keys，写入 source/constants/modelPresets.ts
 */

import { readFileSync, writeFileSync, existsSync } from "fs";

// ============ 生成 meta.ts ============
const pkg = JSON.parse(readFileSync("package.json", "utf-8"));

const metaContent = `// 此文件由 scripts/gen-meta.ts 自动生成，请勿手动修改
export const VERSION = "${pkg.version}";
export const APP_NAME = "${pkg.name}";
`;

writeFileSync("source/constants/meta.ts", metaContent);
console.log(`Generated meta.ts: ${pkg.name} v${pkg.version}`);

// ============ 生成 modelPresets.ts ============
// 读取 .env.local 文件
function loadEnvFile(filePath: string): Record<string, string> {
	const env: Record<string, string> = {};
	if (!existsSync(filePath)) {
		return env;
	}
	const content = readFileSync(filePath, "utf-8");
	for (const line of content.split("\n")) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith("#")) continue;
		const eqIndex = trimmed.indexOf("=");
		if (eqIndex > 0) {
			const key = trimmed.slice(0, eqIndex).trim();
			const value = trimmed.slice(eqIndex + 1).trim();
			env[key] = value;
		}
	}
	return env;
}

const localEnv = loadEnvFile(".env.local");
const siliconflowKey = localEnv["SILICONFLOW_API_KEY"] || "";
const dashscopeKey = localEnv["DASHSCOPE_API_KEY"] || "";
const anthropicKey = localEnv["ANTHROPIC_API_KEY"] || "";

const presetsContent = `// 此文件由 scripts/gen-meta.ts 自动生成，请勿手动修改
// API keys 从 .env.local 读取，该文件不会提交到 git

import type { ModelConfig } from "../utils/config.js";

/**
 * 默认模型预设列表（测试期间使用）
 *
 * 包含完整的模型配置，包括 baseUrl 和 apiKey
 * 每个模型可以有不同的 API 端点和密钥
 * 正式版本会根据用户账号派发可用的模型配置
 */
export const DEFAULT_MODEL_PRESETS: ModelConfig[] = [
	// Qwen 系列 - Ollama API
	{
		model: "qwen3-coder:30b",
		name: "Qwen3 Coder 30B Int4",
		protocol: "openai",
		description: "Qwen3 30B Int4 for Codering, optimized for programming tasks.",
		supportsTools: true,
		supportsThinking: true,
		thinkingParams: {
			enabled: { think: true },
			disabled: { think: false },
		},
		contextWindow: 32768,
		baseUrl: "http://192.168.110.110:11434/v1",
	},
];
`;

writeFileSync("source/constants/modelPresets.ts", presetsContent);
console.log(
	`Generated modelPresets.ts with ${siliconflowKey ? "SiliconFlow" : "no"}, ${anthropicKey ? "Anthropic" : "no"}, and ${dashscopeKey ? "DashScope" : "no"} API keys`,
);
