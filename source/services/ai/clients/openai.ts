/**
 * OpenAI 客户端实现
 * 支持 OpenAI API 及兼容 API (如 Azure OpenAI, vLLM, Ollama 等)
 */

import type {
	IAIClient,
	AIClientConfig,
	ChatMessage,
	AIResponse,
	OpenAITool,
	FinishReason,
} from "../types.js";
import { toOpenAIMessages, parseOpenAIToolCalls } from "../adapters/openai.js";

/**
 * OpenAI API 响应类型
 */
type OpenAIAPIResponse = {
	id: string;
	object: string;
	created: number;
	model: string;
	choices: Array<{
		index: number;
		message: {
			role: string;
			content: string | null;
			tool_calls?: Array<{
				id: string;
				type: string;
				function: {
					name: string;
					arguments: string;
				};
			}>;
		};
		finish_reason: string;
	}>;
	usage?: {
		prompt_tokens: number;
		completion_tokens: number;
		total_tokens: number;
	};
};

/**
 * OpenAI 客户端
 */
export class OpenAIClient implements IAIClient {
	private config: AIClientConfig;

	constructor(config: AIClientConfig) {
		this.config = {
			baseUrl: "https://api.openai.com",
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
		// 构建 URL：baseUrl 应该已经包含 /v1，只需添加 /chat/completions
		const baseUrl =
			this.config.baseUrl?.replace(/\/$/, "") || "https://api.openai.com/v1";
		const url = `${baseUrl}/chat/completions`;

		const body: Record<string, unknown> = {
			model: this.config.model,
			messages: toOpenAIMessages(messages),
		};

		if (tools && tools.length > 0) {
			body.tools = tools;
			body.tool_choice = "auto";
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
						Authorization: `Bearer ${this.config.apiKey}`,
						"Content-Type": "application/json",
					},
					body: JSON.stringify(body),
					signal: controller.signal,
				});

				clearTimeout(timeoutId);

				if (!response.ok) {
					const errorText = await response.text();
					throw new Error(
						`OpenAI API error: ${response.status} ${response.statusText} - ${errorText}`,
					);
				}

				const data = (await response.json()) as OpenAIAPIResponse;
				return this.parseResponse(data);
			} catch (error) {
				lastError = error instanceof Error ? error : new Error(String(error));

				// 如果是最后一次尝试或者是中止错误，直接抛出
				if (attempt === maxRetries - 1 || lastError.name === "AbortError") {
					throw lastError;
				}

				// 等待后重试
				await new Promise((resolve) =>
					setTimeout(resolve, Math.pow(2, attempt) * 1000),
				);
			}
		}

		throw lastError || new Error("Unknown error");
	}

	private parseResponse(data: OpenAIAPIResponse): AIResponse {
		const choice = data.choices[0];
		if (!choice) {
			throw new Error("No response from OpenAI API");
		}

		const message: ChatMessage = {
			role: "assistant",
			content: choice.message.content || "",
		};

		// 解析 tool_calls
		if (choice.message.tool_calls && choice.message.tool_calls.length > 0) {
			message.tool_calls = parseOpenAIToolCalls(choice.message.tool_calls);
		}

		// 转换 finish_reason
		let finishReason: FinishReason = "stop";
		switch (choice.finish_reason) {
			case "stop":
				finishReason = "stop";
				break;
			case "tool_calls":
				finishReason = "tool_calls";
				break;
			case "length":
				finishReason = "length";
				break;
			default:
				finishReason = "stop";
		}

		return {
			message,
			finish_reason: finishReason,
			usage: data.usage,
		};
	}
}
