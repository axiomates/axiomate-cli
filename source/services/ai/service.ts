/**
 * AI 服务
 * 实现上下文感知 + 工具调用循环
 * 使用本地目录分析自动选择工具（不使用两阶段 AI 调用）
 */

import type {
	IAIService,
	IAIClient,
	AIServiceConfig,
	ChatMessage,
	MatchContext,
	OpenAITool,
} from "./types.js";
import type { IToolRegistry } from "../tools/types.js";
import type { IToolMatcher } from "./types.js";
import { toOpenAITools } from "./adapters/openai.js";
import { ToolCallHandler } from "./tool-call-handler.js";
import { ToolMatcher, detectProjectType } from "../tools/matcher.js";

/**
 * 默认上下文窗口大小
 */
const DEFAULT_CONTEXT_WINDOW = 32768;

/**
 * AI 服务实现
 */
export class AIService implements IAIService {
	private client: IAIClient;
	private registry: IToolRegistry;
	private matcher: IToolMatcher;
	private toolCallHandler: ToolCallHandler;

	private history: ChatMessage[] = [];
	private systemPrompt: string = "";

	private maxToolCallRounds: number;
	private contextAwareEnabled: boolean;
	private contextWindow: number;

	constructor(config: AIServiceConfig, registry: IToolRegistry) {
		this.client = config.client;
		this.registry = registry;
		this.matcher = new ToolMatcher(registry);
		this.toolCallHandler = new ToolCallHandler(registry);

		this.maxToolCallRounds = config.maxToolCallRounds ?? 5;
		this.contextAwareEnabled = config.contextAwareEnabled ?? true;
		this.contextWindow = config.contextWindow ?? DEFAULT_CONTEXT_WINDOW;
	}

	/**
	 * 设置系统提示词
	 */
	setSystemPrompt(prompt: string): void {
		this.systemPrompt = prompt;
	}

	/**
	 * 获取对话历史
	 */
	getHistory(): ChatMessage[] {
		return [...this.history];
	}

	/**
	 * 清空对话历史
	 */
	clearHistory(): void {
		this.history = [];
	}

	/**
	 * 获取上下文窗口大小
	 */
	getContextWindow(): number {
		return this.contextWindow;
	}

	/**
	 * 发送消息并获取响应
	 */
	async sendMessage(
		userMessage: string,
		context?: MatchContext,
	): Promise<string> {
		// 添加用户消息到历史
		this.history.push({
			role: "user",
			content: userMessage,
		});

		// 增强上下文
		const enhancedContext = this.enhanceContext(context);

		// 使用本地上下文匹配选择工具
		return this.contextAwareChat(userMessage, enhancedContext);
	}

	/**
	 * 增强上下文信息
	 */
	private enhanceContext(context?: MatchContext): MatchContext {
		const enhanced: MatchContext = { ...context };

		// 自动检测项目类型
		if (this.contextAwareEnabled && enhanced.cwd && !enhanced.projectType) {
			enhanced.projectType = detectProjectType(enhanced.cwd);
		}

		return enhanced;
	}

	/**
	 * 上下文感知的对话
	 * 使用本地目录分析自动选择工具，无需两阶段 AI 调用
	 */
	private async contextAwareChat(
		userMessage: string,
		context: MatchContext,
	): Promise<string> {
		// 获取相关工具
		let tools: OpenAITool[] = [];

		if (this.contextAwareEnabled) {
			// 1. 根据项目类型和文件自动选择工具
			const autoSelectedTools = this.matcher.autoSelect(context);

			// 2. 根据用户消息关键词匹配工具
			const queryMatches = this.matcher.match(userMessage, context);

			// 3. 合并工具，去重
			const toolIds = new Set<string>();
			for (const tool of autoSelectedTools) {
				toolIds.add(tool.id);
			}
			for (const match of queryMatches.slice(0, 10)) {
				toolIds.add(match.tool.id);
			}

			// 4. 转换为 OpenAI 工具格式
			const filteredTools = Array.from(toolIds)
				.map((id) => this.registry.getTool(id))
				.filter(
					(t): t is NonNullable<typeof t> => t !== undefined && t.installed,
				);

			tools = toOpenAITools(filteredTools);
		}

		// 如果有工具，带工具对话；否则直接对话
		if (tools.length > 0) {
			return this.chatWithTools(tools);
		}
		return this.directChat();
	}

	/**
	 * 直接对话（不带工具）
	 */
	private async directChat(): Promise<string> {
		const messages = this.buildMessages();

		const response = await this.client.chat(messages);

		// 添加到历史
		this.history.push(response.message);

		return response.message.content;
	}

	/**
	 * 带工具的对话
	 */
	private async chatWithTools(tools: OpenAITool[]): Promise<string> {
		const messages = this.buildMessages();
		let rounds = 0;

		while (rounds < this.maxToolCallRounds) {
			const response = await this.client.chat(messages, tools);

			// 检查是否需要执行工具
			if (
				response.finish_reason === "tool_calls" &&
				response.message.tool_calls &&
				response.message.tool_calls.length > 0
			) {
				// 添加 assistant 消息到历史
				this.history.push(response.message);
				messages.push(response.message);

				// 执行工具调用
				const toolResults = await this.toolCallHandler.handleToolCalls(
					response.message.tool_calls,
				);

				// 添加工具结果到历史和消息
				for (const result of toolResults) {
					this.history.push(result);
					messages.push(result);
				}

				rounds++;
				continue;
			}

			// 没有工具调用，返回最终响应
			this.history.push(response.message);
			return response.message.content;
		}

		// 达到最大轮数
		return "已达到最大工具调用轮数限制。";
	}

	/**
	 * 构建消息列表
	 */
	private buildMessages(): ChatMessage[] {
		const messages: ChatMessage[] = [];

		// 添加系统提示词
		if (this.systemPrompt) {
			messages.push({
				role: "system",
				content: this.systemPrompt,
			});
		}

		// 添加历史消息
		messages.push(...this.history);

		return messages;
	}
}

/**
 * 创建 AI 服务
 */
export function createAIService(
	config: AIServiceConfig,
	registry: IToolRegistry,
): IAIService {
	return new AIService(config, registry);
}
