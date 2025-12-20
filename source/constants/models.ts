/**
 * 模型预设定义
 *
 * 统一定义所有支持的 AI 模型，包含元数据和能力信息
 * 通过硅基流动服务统一接入，baseUrl 由用户配置提供
 */

/**
 * 模型系列
 */
export type ModelSeries = "glm" | "qwen" | "deepseek";

/**
 * API 协议类型
 * - openai: OpenAI 兼容协议（/chat/completions）
 * - anthropic: Anthropic 原生协议（/messages）
 */
export type ApiProtocol = "openai" | "anthropic";

/**
 * 模型预设定义
 */
export type ModelPreset = {
	/** 唯一标识 */
	id: string;
	/** 显示名称 */
	name: string;
	/** 所属系列 */
	series: ModelSeries;
	/** API 协议类型 */
	protocol: ApiProtocol;
	/** 简短描述 */
	description?: string;
	/** 是否支持 function calling / tools */
	supportsTools: boolean;
	/** 是否支持推理/thinking mode */
	supportsThinking: boolean;
	/** API 调用时的模型名 */
	apiModel: string;
};

/**
 * 预设模型列表
 */
export const MODEL_PRESETS: ModelPreset[] = [
	// ============================================================================
	// GLM 系列（智谱）
	// ============================================================================
	{
		id: "glm-4-9b",
		name: "GLM-4 9B",
		series: "glm",
		protocol: "openai",
		description: "Chat model",
		supportsTools: true,
		supportsThinking: false,
		apiModel: "THUDM/glm-4-9b-chat",
	},
	{
		id: "glm-z1-9b",
		name: "GLM-Z1 9B",
		series: "glm",
		protocol: "openai",
		description: "Latest GLM",
		supportsTools: true,
		supportsThinking: false,
		apiModel: "THUDM/GLM-Z1-9B-0414",
	},

	// ============================================================================
	// Qwen 系列
	// ============================================================================
	{
		id: "qwen3-8b",
		name: "Qwen3 8B",
		series: "qwen",
		protocol: "openai",
		description: "Latest Qwen3",
		supportsTools: true,
		supportsThinking: true,
		apiModel: "Qwen/Qwen3-8B",
	},
	{
		id: "qwen2-7b",
		name: "Qwen2 7B",
		series: "qwen",
		protocol: "openai",
		description: "Instruct model",
		supportsTools: false,
		supportsThinking: false,
		apiModel: "Qwen/Qwen2-7B-Instruct",
	},
	{
		id: "qwen2.5-7b",
		name: "Qwen2.5 7B",
		series: "qwen",
		protocol: "openai",
		description: "Instruct model",
		supportsTools: true,
		supportsThinking: false,
		apiModel: "Qwen/Qwen2.5-7B-Instruct",
	},

	// ============================================================================
	// DeepSeek 系列
	// ============================================================================
	{
		id: "deepseek-r1-qwen-7b",
		name: "DeepSeek R1 Qwen 7B",
		series: "deepseek",
		protocol: "openai",
		description: "Reasoning distill",
		supportsTools: false,
		supportsThinking: true,
		apiModel: "deepseek-ai/DeepSeek-R1-Distill-Qwen-7B",
	},
];

/**
 * 默认模型 ID（开箱即用）
 */
export const DEFAULT_MODEL_ID = "qwen3-8b";

// ============================================================================
// 辅助函数
// ============================================================================

/**
 * 根据 ID 获取模型预设
 */
export function getModelById(id: string): ModelPreset | undefined {
	return MODEL_PRESETS.find((m) => m.id === id);
}

/**
 * 根据系列获取模型列表
 */
export function getModelsBySeries(series: ModelSeries): ModelPreset[] {
	return MODEL_PRESETS.filter((m) => m.series === series);
}

/**
 * 获取所有系列（按出现顺序）
 */
export function getAllSeries(): ModelSeries[] {
	const seen = new Set<ModelSeries>();
	const result: ModelSeries[] = [];
	for (const model of MODEL_PRESETS) {
		if (!seen.has(model.series)) {
			seen.add(model.series);
			result.push(model.series);
		}
	}
	return result;
}

/**
 * 获取系列显示名称
 */
export function getSeriesDisplayName(series: ModelSeries): string {
	const names: Record<ModelSeries, string> = {
		glm: "GLM",
		qwen: "Qwen",
		deepseek: "DeepSeek",
	};
	return names[series] || series;
}

/**
 * 获取默认模型预设
 */
export function getDefaultModel(): ModelPreset {
	const model = getModelById(DEFAULT_MODEL_ID);
	if (!model) {
		throw new Error(`Default model ${DEFAULT_MODEL_ID} not found`);
	}
	return model;
}
