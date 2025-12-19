/**
 * AI 服务
 * 实现两阶段调用 + 上下文感知 + 工具调用循环
 */

import type {
	IAIService,
	IAIClient,
	AIServiceConfig,
	ChatMessage,
	MatchContext,
	IntentAnalysis,
	OpenAITool,
} from "./types.js";
import type { IToolRegistry } from "../tools/types.js";
import type { IToolMatcher } from "./types.js";
import { toOpenAITools } from "./adapters/openai.js";
import { ToolCallHandler } from "./tool-call-handler.js";
import { ToolMatcher, detectProjectType } from "../tools/matcher.js";

/**
 * 两阶段调用的系统提示词
 */
const INTENT_ANALYSIS_PROMPT = `你是一个工具需求分析助手。分析用户的请求，判断是否需要使用工具来完成任务。

如果需要工具，列出需要的工具能力（如：version_control, file_comparison, code_execution 等）。
如果不需要工具，直接回答用户问题。

请以 JSON 格式回复：
{
  "needsTools": true/false,
  "requiredCapabilities": ["capability1", "capability2"],
  "intent": "用户意图的简短描述"
}

如果 needsTools 为 false，在 JSON 后面直接给出回答。`;

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

	private twoPhaseEnabled: boolean;
	private maxToolCallRounds: number;
	private contextAwareEnabled: boolean;

	constructor(config: AIServiceConfig, registry: IToolRegistry) {
		this.client = config.client;
		this.registry = registry;
		this.matcher = new ToolMatcher(registry);
		this.toolCallHandler = new ToolCallHandler(registry);

		this.twoPhaseEnabled = config.twoPhaseEnabled ?? true;
		this.maxToolCallRounds = config.maxToolCallRounds ?? 5;
		this.contextAwareEnabled = config.contextAwareEnabled ?? true;
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

		// 两阶段调用
		if (this.twoPhaseEnabled) {
			return this.twoPhaseCall(userMessage, enhancedContext);
		}

		// 单阶段调用（直接提供所有工具）
		return this.singlePhaseCall(userMessage, enhancedContext);
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
	 * 两阶段调用
	 * 第一阶段：分析用户意图，确定需要的工具
	 * 第二阶段：使用筛选后的工具进行对话
	 */
	private async twoPhaseCall(
		userMessage: string,
		context: MatchContext,
	): Promise<string> {
		// 第一阶段：意图分析
		const intentAnalysis = await this.analyzeIntent(userMessage);

		if (!intentAnalysis.needsTools) {
			// 不需要工具，直接对话
			return this.directChat();
		}

		// 根据意图匹配工具
		const matchedTools = this.matchToolsForIntent(intentAnalysis, context);

		if (matchedTools.length === 0) {
			// 没有匹配的工具，直接对话
			return this.directChat();
		}

		// 第二阶段：带工具的对话
		return this.chatWithTools(matchedTools);
	}

	/**
	 * 分析用户意图
	 */
	private async analyzeIntent(userMessage: string): Promise<IntentAnalysis> {
		try {
			const response = await this.client.chat([
				{ role: "system", content: INTENT_ANALYSIS_PROMPT },
				{ role: "user", content: userMessage },
			]);

			const content = response.message.content;

			// 尝试解析 JSON
			const jsonMatch = content.match(/\{[\s\S]*?\}/);
			if (jsonMatch) {
				const parsed = JSON.parse(jsonMatch[0]) as IntentAnalysis;
				return {
					needsTools: parsed.needsTools ?? false,
					requiredCapabilities: parsed.requiredCapabilities ?? [],
					intent: parsed.intent ?? "",
				};
			}

			// 解析失败，默认不需要工具
			return {
				needsTools: false,
				requiredCapabilities: [],
				intent: userMessage,
			};
		} catch {
			// 分析失败，默认不需要工具
			return {
				needsTools: false,
				requiredCapabilities: [],
				intent: userMessage,
			};
		}
	}

	/**
	 * 根据意图匹配工具
	 */
	private matchToolsForIntent(
		intent: IntentAnalysis,
		context: MatchContext,
	): OpenAITool[] {
		const matchedToolIds = new Set<string>();

		// 根据能力匹配
		for (const capability of intent.requiredCapabilities) {
			const tools = this.matcher.matchByCapability(capability);
			for (const tool of tools) {
				matchedToolIds.add(tool.id);
			}
		}

		// 根据意图描述匹配
		const queryMatches = this.matcher.match(intent.intent, context);
		for (const match of queryMatches.slice(0, 5)) {
			matchedToolIds.add(match.tool.id);
		}

		// 上下文自动选择
		if (this.contextAwareEnabled) {
			const autoSelected = this.matcher.autoSelect(context);
			for (const tool of autoSelected) {
				matchedToolIds.add(tool.id);
			}
		}

		// 转换为 OpenAI 工具格式
		const tools: OpenAITool[] = [];
		for (const toolId of matchedToolIds) {
			const tool = this.registry.getTool(toolId);
			if (tool?.installed) {
				tools.push(...toOpenAITools([tool]));
			}
		}

		return tools;
	}

	/**
	 * 单阶段调用（提供所有工具）
	 */
	private async singlePhaseCall(
		userMessage: string,
		context: MatchContext,
	): Promise<string> {
		// 获取所有已安装工具
		let tools: OpenAITool[];

		if (this.contextAwareEnabled) {
			// 上下文感知：只提供相关工具
			const relevantTools = this.matcher.autoSelect(context);
			const queryMatches = this.matcher.match(userMessage, context);

			const toolIds = new Set<string>();
			for (const tool of relevantTools) {
				toolIds.add(tool.id);
			}
			for (const match of queryMatches.slice(0, 10)) {
				toolIds.add(match.tool.id);
			}

			const filteredTools = Array.from(toolIds)
				.map((id) => this.registry.getTool(id))
				.filter(
					(t): t is NonNullable<typeof t> => t !== undefined && t.installed,
				);

			tools = toOpenAITools(filteredTools);
		} else {
			// 提供所有工具
			tools = toOpenAITools(this.registry.getInstalled());
		}

		return this.chatWithTools(tools);
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
