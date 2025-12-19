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
	type AIProvider,
	type AIModelConfig,
	type AIConfig,
	MODEL_PRESETS,
	loadAIConfig,
	saveAIConfig,
	updateAIConfig,
	getCurrentModelConfig,
	setCurrentModel,
	addModelConfig,
	addModelFromPreset,
	removeModelConfig,
	listConfiguredModels,
	validateModelConfig,
	getAIConfigPath,
} from "./config.js";

// 工厂函数：创建完整的 AI 服务实例
import type { IToolRegistry } from "../tools/types.js";
import type { IAIClient, IAIService } from "./types.js";
import { OpenAIClient } from "./clients/openai.js";
import { AnthropicClient } from "./clients/anthropic.js";
import { AIService } from "./service.js";
import {
	getCurrentModelConfig,
	loadAIConfig,
	type AIModelConfig,
} from "./config.js";

/**
 * 根据配置创建 AI 客户端
 */
export function createAIClient(modelConfig: AIModelConfig): IAIClient {
	const config = {
		apiKey: modelConfig.apiKey,
		model: modelConfig.model,
		baseUrl: modelConfig.baseUrl,
	};

	switch (modelConfig.provider) {
		case "anthropic":
			return new AnthropicClient(config);
		case "openai":
		case "azure":
		case "custom":
		default:
			return new OpenAIClient(config);
	}
}

/**
 * 创建 AI 服务实例（使用当前配置）
 */
export function createAIServiceFromConfig(
	registry: IToolRegistry,
): IAIService | null {
	const modelConfig = getCurrentModelConfig();
	if (!modelConfig) {
		return null;
	}

	const aiConfig = loadAIConfig();
	const client = createAIClient(modelConfig);

	return new AIService(
		{
			client,
			twoPhaseEnabled: aiConfig.twoPhaseEnabled,
			contextAwareEnabled: aiConfig.contextAwareEnabled,
			maxToolCallRounds: aiConfig.maxToolCallRounds,
		},
		registry,
	);
}
