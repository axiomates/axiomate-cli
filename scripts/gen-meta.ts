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

// 检查是否有 API keys
if (!siliconflowKey && !dashscopeKey) {
	console.log("Warning: No API keys found in .env.local, modelPresets.ts will have empty keys");
}

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
	// GLM 系列（智谱）- 使用 SiliconFlow
	{
		model: "THUDM/glm-4-9b-chat",
		name: "GLM-4 9B",
		protocol: "openai",
		description: "Chat model",
		supportsTools: false,
		supportsThinking: false,
		contextWindow: 131072,
		baseUrl: "https://api.siliconflow.cn/v1",
		apiKey: "${siliconflowKey}",
	},
	{
		model: "THUDM/GLM-Z1-9B-0414",
		name: "GLM-Z1 9B",
		protocol: "openai",
		description: "Latest GLM",
		supportsTools: true,
		supportsThinking: false,
		contextWindow: 32768,
		baseUrl: "https://api.siliconflow.cn/v1",
		apiKey: "${siliconflowKey}",
	},

	// Qwen 系列 - 使用 SiliconFlow
	{
		model: "Qwen/Qwen3-8B",
		name: "Qwen3 8B",
		protocol: "openai",
		description: "Latest Qwen3",
		supportsTools: true,
		supportsThinking: true,
		contextWindow: 131072,
		baseUrl: "https://api.siliconflow.cn/v1",
		apiKey: "${siliconflowKey}",
	},
	{
		model: "Qwen/Qwen2-7B-Instruct",
		name: "Qwen2 7B",
		protocol: "openai",
		description: "Instruct model",
		supportsTools: false,
		supportsThinking: true,
		contextWindow: 32768,
		baseUrl: "https://api.siliconflow.cn/v1",
		apiKey: "${siliconflowKey}",
	},
	{
		model: "Qwen/Qwen2.5-7B-Instruct",
		name: "Qwen2.5 7B",
		protocol: "openai",
		description: "Instruct model",
		supportsTools: true,
		supportsThinking: false,
		contextWindow: 32768,
		baseUrl: "https://api.siliconflow.cn/v1",
		apiKey: "${siliconflowKey}",
	},
	{
		model: "Qwen/Qwen3-Coder-480B-A35B-Instruct",
		name: "Qwen3 Coder 480B",
		protocol: "openai",
		description: "Instruct model",
		supportsTools: true,
		supportsThinking: false,
		contextWindow: 262144,
		baseUrl: "https://api.siliconflow.cn/v1",
		apiKey: "${siliconflowKey}",
	},
	{
		model: "qwen3-coder-plus",
		name: "Qwen3 Coder Plus",
		protocol: "openai",
		description: "Super coder model",
		supportsTools: true,
		supportsThinking: true,
		contextWindow: 1048576,
		baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
		apiKey: "${dashscopeKey}",
	},

	// DeepSeek 系列 - 使用 SiliconFlow
	{
		model: "deepseek-ai/DeepSeek-R1-Distill-Qwen-7B",
		name: "DeepSeek R1 Qwen 7B",
		protocol: "openai",
		description: "Reasoning distill",
		supportsTools: true,
		supportsThinking: true,
		contextWindow: 131072,
		baseUrl: "https://api.siliconflow.cn/v1",
		apiKey: "${siliconflowKey}",
	},
	{
		model: "Pro/deepseek-ai/DeepSeek-V3.2",
		name: "DeepSeek-V3.2",
		protocol: "openai",
		description: "Reasoning model",
		supportsTools: true,
		supportsThinking: true,
		contextWindow: 163840,
		baseUrl: "https://api.siliconflow.cn/v1",
		apiKey: "${siliconflowKey}",
	},
];
`;

writeFileSync("source/constants/modelPresets.ts", presetsContent);
console.log(`Generated modelPresets.ts with ${siliconflowKey ? "SiliconFlow" : "no"} and ${dashscopeKey ? "DashScope" : "no"} API keys`);
