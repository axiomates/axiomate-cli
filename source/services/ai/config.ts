/**
 * AI 配置管理
 * 支持多个 AI 提供商的配置
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

/**
 * AI 提供商类型
 */
export type AIProvider = "openai" | "anthropic" | "azure" | "custom";

/**
 * AI 模型配置
 */
export type AIModelConfig = {
	provider: AIProvider;
	apiKey: string;
	model: string;
	baseUrl?: string;
	// 额外配置（如 Azure 需要的 deployment name）
	extra?: Record<string, string>;
};

/**
 * AI 配置
 */
export type AIConfig = {
	// 当前使用的模型 ID
	currentModel: string;
	// 模型配置列表
	models: Record<string, AIModelConfig>;
	// 两阶段调用设置
	twoPhaseEnabled: boolean;
	// 上下文感知设置
	contextAwareEnabled: boolean;
	// 最大工具调用轮数
	maxToolCallRounds: number;
};

/**
 * 默认配置
 */
const DEFAULT_AI_CONFIG: AIConfig = {
	currentModel: "",
	models: {},
	twoPhaseEnabled: true,
	contextAwareEnabled: true,
	maxToolCallRounds: 5,
};

/**
 * 预定义模型配置模板
 */
export const MODEL_PRESETS: Record<string, Partial<AIModelConfig>> = {
	// OpenAI 模型
	"gpt-4o": {
		provider: "openai",
		model: "gpt-4o",
	},
	"gpt-4-turbo": {
		provider: "openai",
		model: "gpt-4-turbo",
	},
	"gpt-4": {
		provider: "openai",
		model: "gpt-4",
	},
	"gpt-3.5-turbo": {
		provider: "openai",
		model: "gpt-3.5-turbo",
	},

	// Anthropic 模型
	"claude-3-opus": {
		provider: "anthropic",
		model: "claude-3-opus-20240229",
	},
	"claude-3-sonnet": {
		provider: "anthropic",
		model: "claude-3-sonnet-20240229",
	},
	"claude-3-haiku": {
		provider: "anthropic",
		model: "claude-3-haiku-20240307",
	},
	"claude-3.5-sonnet": {
		provider: "anthropic",
		model: "claude-3-5-sonnet-20241022",
	},

	// 其他模型（需要自定义 baseUrl）
	"deepseek-v3": {
		provider: "custom",
		model: "deepseek-chat",
		baseUrl: "https://api.deepseek.com",
	},
	"qwen-72b": {
		provider: "custom",
		model: "qwen-72b-chat",
		baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
	},
	"llama-3.3-70b": {
		provider: "custom",
		model: "llama-3.3-70b-versatile",
		baseUrl: "https://api.groq.com/openai/v1",
	},
};

// 配置文件名
const AI_CONFIG_FILENAME = ".axiomate-ai.json";

// 运行时配置
let runtimeAIConfig: AIConfig | null = null;

/**
 * 获取配置文件路径
 */
export function getAIConfigPath(): string {
	const homeDir = os.homedir();
	return path.join(homeDir, AI_CONFIG_FILENAME);
}

/**
 * 加载 AI 配置
 */
export function loadAIConfig(): AIConfig {
	if (runtimeAIConfig !== null) {
		return structuredClone(runtimeAIConfig);
	}

	const configPath = getAIConfigPath();

	if (!fs.existsSync(configPath)) {
		runtimeAIConfig = structuredClone(DEFAULT_AI_CONFIG);
		return structuredClone(runtimeAIConfig);
	}

	try {
		const content = fs.readFileSync(configPath, "utf-8");
		const config = JSON.parse(content) as Partial<AIConfig>;
		runtimeAIConfig = {
			...DEFAULT_AI_CONFIG,
			...config,
		};
		return structuredClone(runtimeAIConfig);
	} catch {
		runtimeAIConfig = structuredClone(DEFAULT_AI_CONFIG);
		return structuredClone(runtimeAIConfig);
	}
}

/**
 * 保存 AI 配置
 */
export function saveAIConfig(config: AIConfig): void {
	runtimeAIConfig = structuredClone(config);
	const configPath = getAIConfigPath();
	fs.writeFileSync(configPath, JSON.stringify(config, null, 2), "utf-8");
}

/**
 * 更新 AI 配置
 */
export function updateAIConfig(updates: Partial<AIConfig>): AIConfig {
	const current = loadAIConfig();
	const updated: AIConfig = {
		...current,
		...updates,
	};
	saveAIConfig(updated);
	return updated;
}

/**
 * 获取当前模型配置
 */
export function getCurrentModelConfig(): AIModelConfig | null {
	const config = loadAIConfig();
	if (!config.currentModel || !config.models[config.currentModel]) {
		return null;
	}
	return config.models[config.currentModel];
}

/**
 * 设置当前模型
 */
export function setCurrentModel(modelId: string): boolean {
	const config = loadAIConfig();
	if (!config.models[modelId]) {
		return false;
	}
	updateAIConfig({ currentModel: modelId });
	return true;
}

/**
 * 添加模型配置
 */
export function addModelConfig(
	modelId: string,
	modelConfig: AIModelConfig,
): void {
	const config = loadAIConfig();
	config.models[modelId] = modelConfig;

	// 如果是第一个模型，自动设为当前模型
	if (!config.currentModel) {
		config.currentModel = modelId;
	}

	saveAIConfig(config);
}

/**
 * 从预设添加模型
 */
export function addModelFromPreset(presetId: string, apiKey: string): boolean {
	const preset = MODEL_PRESETS[presetId];
	if (!preset) {
		return false;
	}

	addModelConfig(presetId, {
		provider: preset.provider || "openai",
		model: preset.model || presetId,
		apiKey,
		baseUrl: preset.baseUrl,
	});

	return true;
}

/**
 * 删除模型配置
 */
export function removeModelConfig(modelId: string): boolean {
	const config = loadAIConfig();
	if (!config.models[modelId]) {
		return false;
	}

	delete config.models[modelId];

	// 如果删除的是当前模型，清空当前模型
	if (config.currentModel === modelId) {
		const remaining = Object.keys(config.models);
		config.currentModel = remaining.length > 0 ? remaining[0] : "";
	}

	saveAIConfig(config);
	return true;
}

/**
 * 获取所有已配置模型列表
 */
export function listConfiguredModels(): Array<{
	id: string;
	config: AIModelConfig;
	isCurrent: boolean;
}> {
	const config = loadAIConfig();
	return Object.entries(config.models).map(([id, modelConfig]) => ({
		id,
		config: modelConfig,
		isCurrent: id === config.currentModel,
	}));
}

/**
 * 验证模型配置是否可用
 */
export function validateModelConfig(modelConfig: AIModelConfig): {
	valid: boolean;
	errors: string[];
} {
	const errors: string[] = [];

	if (!modelConfig.apiKey) {
		errors.push("API Key 未配置");
	}

	if (!modelConfig.model) {
		errors.push("模型名称未配置");
	}

	if (!modelConfig.provider) {
		errors.push("提供商未配置");
	}

	return {
		valid: errors.length === 0,
		errors,
	};
}
