/**
 * Anthropic 客户端实现
 * 支持 Claude API
 */

import type {
	IAIClient,
	AIClientConfig,
	ChatMessage,
	AIResponse,
	OpenAITool,
	FinishReason,
	AnthropicTool,
} from "../types.js";
import {
	toAnthropicMessages,
	extractSystemMessage,
	parseAnthropicToolUse,
} from "../adapters/anthropic.js";

/**
 * Anthropic API 响应类型
 */
type AnthropicAPIResponse = {
	id: string;
	type: "message";
	role: "assistant";
	content: Array<
		| { type: "text"; text: string }
		| {
				type: "tool_use";
				id: string;
				name: string;
				input: Record<string, unknown>;
		  }
	>;
	model: string;
	stop_reason: "end_turn" | "tool_use" | "max_tokens" | "stop_sequence";
	stop_sequence: string | null;
	usage: {
		input_tokens: number;
		output_tokens: number;
	};
};

/**
 * 将 OpenAI 工具格式转换为 Anthropic 格式
 */
function openAIToolsToAnthropic(tools: OpenAITool[]): AnthropicTool[] {
	return tools.map((tool) => ({
		name: tool.function.name,
		description: tool.function.description,
		input_schema: tool.function.parameters,
	}));
}

/**
 * Anthropic 客户端
 */
export class AnthropicClient implements IAIClient {
	private config: AIClientConfig;

	constructor(config: AIClientConfig) {
		this.config = {
			baseUrl: "https://api.anthropic.com",
			timeout: 60000,
			maxRetries: 3,
			...config,
		};
	}

	getConfig(): AIClientConfig {
		return { ...this.config };
	}

	async chat(
		messages: ChatMessage[],
		tools?: OpenAITool[],
	): Promise<AIResponse> {
		const url = `${this.config.baseUrl}/v1/messages`;

		// 提取 system 消息
		const systemPrompt = extractSystemMessage(messages);

		const body: Record<string, unknown> = {
			model: this.config.model,
			messages: toAnthropicMessages(messages),
			max_tokens: 4096,
		};

		if (systemPrompt) {
			body.system = systemPrompt;
		}

		if (tools && tools.length > 0) {
			body.tools = openAIToolsToAnthropic(tools);
		}

		let lastError: Error | null = null;
		const maxRetries = this.config.maxRetries || 3;

		for (let attempt = 0; attempt < maxRetries; attempt++) {
			try {
				const controller = new AbortController();
				const timeoutId = setTimeout(
					() => controller.abort(),
					this.config.timeout || 60000,
				);

				const response = await fetch(url, {
					method: "POST",
					headers: {
						"x-api-key": this.config.apiKey,
						"anthropic-version": "2023-06-01",
						"Content-Type": "application/json",
					},
					body: JSON.stringify(body),
					signal: controller.signal,
				});

				clearTimeout(timeoutId);

				if (!response.ok) {
					const errorText = await response.text();
					throw new Error(
						`Anthropic API error: ${response.status} ${response.statusText} - ${errorText}`,
					);
				}

				const data = (await response.json()) as AnthropicAPIResponse;
				return this.parseResponse(data);
			} catch (error) {
				lastError = error instanceof Error ? error : new Error(String(error));

				if (attempt === maxRetries - 1 || lastError.name === "AbortError") {
					throw lastError;
				}

				await new Promise((resolve) =>
					setTimeout(resolve, Math.pow(2, attempt) * 1000),
				);
			}
		}

		throw lastError || new Error("Unknown error");
	}

	private parseResponse(data: AnthropicAPIResponse): AIResponse {
		// 提取文本内容
		const textContent = data.content
			.filter(
				(block): block is { type: "text"; text: string } =>
					block.type === "text",
			)
			.map((block) => block.text)
			.join("");

		const message: ChatMessage = {
			role: "assistant",
			content: textContent,
		};

		// 解析 tool_use 块
		const toolUseBlocks = data.content.filter(
			(
				block,
			): block is {
				type: "tool_use";
				id: string;
				name: string;
				input: Record<string, unknown>;
			} => block.type === "tool_use",
		);

		if (toolUseBlocks.length > 0) {
			message.tool_calls = parseAnthropicToolUse(toolUseBlocks);
		}

		// 转换 stop_reason
		let finishReason: FinishReason = "stop";
		switch (data.stop_reason) {
			case "end_turn":
				finishReason = "stop";
				break;
			case "tool_use":
				finishReason = "tool_calls";
				break;
			case "max_tokens":
				finishReason = "length";
				break;
			default:
				finishReason = "stop";
		}

		return {
			message,
			finish_reason: finishReason,
			usage: {
				prompt_tokens: data.usage.input_tokens,
				completion_tokens: data.usage.output_tokens,
				total_tokens: data.usage.input_tokens + data.usage.output_tokens,
			},
		};
	}
}
