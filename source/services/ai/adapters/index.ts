/**
 * AI 协议适配器导出
 */

export {
	toOpenAITools,
	toolToOpenAI,
	paramsToJsonSchema,
	parseOpenAIToolCalls,
	buildOpenAIToolResultMessage,
	toOpenAIMessages,
} from "./openai.js";

export {
	toAnthropicTools,
	toolToAnthropic,
	parseAnthropicToolUse,
	buildAnthropicToolResultMessage,
	toAnthropicMessages,
	extractSystemMessage,
} from "./anthropic.js";
