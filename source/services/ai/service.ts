/**
 * AI 服务
 * 实现上下文感知 + 工具调用循环
 * 使用本地目录分析自动选择工具（不使用两阶段 AI 调用）
 * 使用 Session 管理对话历史和 token 追踪
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
import {
	Session,
	type SessionStatus,
	type TrimResult,
	type CompactCheckResult,
} from "./session.js";

/**
 * 默认上下文窗口大小
 */
const DEFAULT_CONTEXT_WINDOW = 32768;

/**
 * 发送消息的结果
 */
export type SendMessageResult = {
	/** 响应内容 */
	content: string;
	/** Session 状态 */
	sessionStatus: SessionStatus;
	/** 是否进行了历史裁剪 */
	historyTrimmed: boolean;
	/** 裁剪详情（如果有裁剪） */
	trimResult?: TrimResult;
};

/**
 * AI 服务实现
 */
export class AIService implements IAIService {
	private client: IAIClient;
	private registry: IToolRegistry;
	private matcher: IToolMatcher;
	private toolCallHandler: ToolCallHandler;
	private session: Session;

	private maxToolCallRounds: number;
	private contextAwareEnabled: boolean;

	constructor(config: AIServiceConfig, registry: IToolRegistry) {
		this.client = config.client;
		this.registry = registry;
		this.matcher = new ToolMatcher(registry);
		this.toolCallHandler = new ToolCallHandler(registry);

		this.maxToolCallRounds = config.maxToolCallRounds ?? 5;
		this.contextAwareEnabled = config.contextAwareEnabled ?? true;

		// 创建 Session
		this.session = new Session({
			contextWindow: config.contextWindow ?? DEFAULT_CONTEXT_WINDOW,
		});
	}

	/**
	 * 设置系统提示词
	 */
	setSystemPrompt(prompt: string): void {
		this.session.setSystemPrompt(prompt);
	}

	/**
	 * 获取对话历史
	 */
	getHistory(): ChatMessage[] {
		return this.session.getHistory();
	}

	/**
	 * 清空对话历史
	 */
	clearHistory(): void {
		this.session.clear();
	}

	/**
	 * 获取上下文窗口大小
	 */
	getContextWindow(): number {
		return this.session.getConfig().contextWindow;
	}

	/**
	 * 获取 Session 状态
	 */
	getSessionStatus(): SessionStatus {
		return this.session.getStatus();
	}

	/**
	 * 获取可用于新消息的 token 数
	 */
	getAvailableTokens(): number {
		return this.session.getAvailableTokens();
	}

	/**
	 * 检查是否需要 compact
	 */
	shouldCompact(estimatedNewTokens: number = 0): CompactCheckResult {
		return this.session.shouldCompact(estimatedNewTokens);
	}

	/**
	 * 使用总结内容重置会话
	 */
	compactWith(summary: string): void {
		this.session.compactWith(summary);
	}

	/**
	 * 发送消息并获取响应
	 * 注意：不再自动裁剪历史，改为在 app.tsx 中检查 shouldCompact 并触发 compact
	 */
	async sendMessage(
		userMessage: string,
		context?: MatchContext,
	): Promise<string> {
		// 添加用户消息到 Session
		this.session.addUserMessage(userMessage);

		// 增强上下文
		const enhancedContext = this.enhanceContext(context);

		// 使用本地上下文匹配选择工具
		const result = await this.contextAwareChat(userMessage, enhancedContext);

		return result.content;
	}

	/**
	 * 发送消息并获取详细结果（包含 Session 状态）
	 */
	async sendMessageWithStatus(
		userMessage: string,
		context?: MatchContext,
	): Promise<SendMessageResult> {
		// 检查是否需要先裁剪历史
		const estimatedTokens = userMessage.length / 4; // 粗略估算
		let trimResult: TrimResult | undefined;

		if (!this.session.canAccommodate(estimatedTokens)) {
			trimResult = this.session.ensureSpace(estimatedTokens);
		}

		// 添加用户消息到 Session
		this.session.addUserMessage(userMessage);

		// 增强上下文
		const enhancedContext = this.enhanceContext(context);

		// 使用本地上下文匹配选择工具
		const result = await this.contextAwareChat(userMessage, enhancedContext);

		return {
			content: result.content,
			sessionStatus: this.session.getStatus(),
			historyTrimmed: trimResult?.trimmed ?? false,
			trimResult,
		};
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
	): Promise<SendMessageResult> {
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
	private async directChat(): Promise<SendMessageResult> {
		const messages = this.session.getMessages();

		const response = await this.client.chat(messages);

		// 添加到 Session（带 usage 信息）
		this.session.addAssistantMessage(response.message, response.usage);

		return {
			content: response.message.content,
			sessionStatus: this.session.getStatus(),
			historyTrimmed: false,
		};
	}

	/**
	 * 带工具的对话
	 */
	private async chatWithTools(tools: OpenAITool[]): Promise<SendMessageResult> {
		const messages = this.session.getMessages();
		let rounds = 0;

		while (rounds < this.maxToolCallRounds) {
			const response = await this.client.chat(messages, tools);

			// 检查是否需要执行工具
			if (
				response.finish_reason === "tool_calls" &&
				response.message.tool_calls &&
				response.message.tool_calls.length > 0
			) {
				// 添加 assistant 消息到 Session
				this.session.addAssistantMessage(response.message, response.usage);
				messages.push(response.message);

				// 执行工具调用
				const toolResults = await this.toolCallHandler.handleToolCalls(
					response.message.tool_calls,
				);

				// 添加工具结果到 Session 和消息
				for (const result of toolResults) {
					this.session.addToolMessage(result);
					messages.push(result);
				}

				rounds++;
				continue;
			}

			// 没有工具调用，返回最终响应
			this.session.addAssistantMessage(response.message, response.usage);

			return {
				content: response.message.content,
				sessionStatus: this.session.getStatus(),
				historyTrimmed: false,
			};
		}

		// 达到最大轮数
		return {
			content: "已达到最大工具调用轮数限制。",
			sessionStatus: this.session.getStatus(),
			historyTrimmed: false,
		};
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
