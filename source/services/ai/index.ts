/**
 * AI 服务模块导出
 */

// 类型导出
export type {
	// 消息类型
	MessageRole,
	ChatMessage,
	ToolCall,
	AIResponse,
	AIStreamChunk,
	FinishReason,

	// 工具格式
	JSONSchema,
	JSONSchemaType,
	OpenAITool,
	AnthropicTool,

	// 客户端接口
	AIClientConfig,
	IAIClient,

	// 匹配器
	MatchContext,
	ProjectType,
	MatchResult,
	IToolMatcher,

	// 调用处理
	ToolExecutionResult,
	IToolCallHandler,

	// AI 服务
	IntentAnalysis,
	AIServiceConfig,
	IAIService,
} from "./types.js";

// 适配器导出
export {
	toOpenAITools,
	toolToOpenAI,
	paramsToJsonSchema,
	parseOpenAIToolCalls,
	buildOpenAIToolResultMessage,
	toOpenAIMessages,
	toAnthropicTools,
	toolToAnthropic,
	parseAnthropicToolUse,
	buildAnthropicToolResultMessage,
	toAnthropicMessages,
	extractSystemMessage,
} from "./adapters/index.js";

// 客户端导出
export { OpenAIClient } from "./clients/openai.js";
export { AnthropicClient } from "./clients/anthropic.js";

// 工具调用处理器
export { ToolCallHandler, createToolCallHandler } from "./tool-call-handler.js";

// AI 服务
export { AIService, createAIService } from "./service.js";

// 配置管理
export {
	getCurrentModel,
	getApiConfig,
	getModelApiConfig,
	isApiConfigValid,
	getCurrentModelId,
	DEFAULT_MODEL_ID,
} from "./config.js";

// 模型预设（从 constants 导出）
export {
	MODEL_PRESETS,
	getModelById,
	getModelsBySeries,
	getAllSeries,
	getSeriesDisplayName,
	getDefaultModel,
	type ModelPreset,
	type ModelSeries,
	type ApiProtocol,
} from "../../constants/models.js";

// 工厂函数：创建完整的 AI 服务实例
import type { IToolRegistry } from "../tools/types.js";
import type { IAIClient, IAIService } from "./types.js";
import { OpenAIClient } from "./clients/openai.js";
import { AnthropicClient } from "./clients/anthropic.js";
import { AIService } from "./service.js";
import {
	getCurrentModel,
	getModelApiConfig,
	isApiConfigValid,
} from "./config.js";
import type { ModelPreset } from "../../constants/models.js";

/**
 * 根据模型预设创建 AI 客户端
 */
export function createAIClient(model: ModelPreset): IAIClient {
	const apiConfig = getModelApiConfig(model);

	const clientConfig = {
		apiKey: apiConfig.apiKey,
		model: apiConfig.apiModel,
		baseUrl: apiConfig.baseUrl,
	};

	switch (apiConfig.protocol) {
		case "anthropic":
			return new AnthropicClient(clientConfig);
		case "openai":
		default:
			return new OpenAIClient(clientConfig);
	}
}

/**
 * 创建 AI 服务实例（使用当前配置）
 *
 * @returns AI 服务实例，如果配置无效则返回 null
 */
export function createAIServiceFromConfig(
	registry: IToolRegistry,
): IAIService | null {
	if (!isApiConfigValid()) {
		return null;
	}

	const model = getCurrentModel();
	const client = createAIClient(model);

	return new AIService(
		{
			client,
			// 根据模型能力调整配置
			contextAwareEnabled: model.supportsTools,
			maxToolCallRounds: 5,
			// 使用模型的上下文窗口大小
			contextWindow: model.contextWindow,
		},
		registry,
	);
}

/**
 * 获取当前模型信息（用于 App 状态）
 */
export function getCurrentModelInfo(): {
	model: ModelPreset;
	isConfigured: boolean;
} {
	const model = getCurrentModel();
	const isConfigured = isApiConfigValid();

	return {
		model,
		isConfigured,
	};
}
