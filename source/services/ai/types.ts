/**
 * AI 服务类型定义
 */

import type { DiscoveredTool, ToolAction } from "../tools/types.js";

// ============================================================================
// Chat Message Types
// ============================================================================

/**
 * 聊天消息角色
 */
export type MessageRole = "user" | "assistant" | "system" | "tool";

/**
 * 工具调用信息
 */
export type ToolCall = {
	id: string;
	type: "function";
	function: {
		name: string; // 格式: toolId_actionName (如 "git_status")
		arguments: string; // JSON 字符串
	};
};

/**
 * 聊天消息
 */
export type ChatMessage = {
	role: MessageRole;
	content: string;
	// 工具调用结果的关联 ID
	tool_call_id?: string;
	// AI 返回的工具调用请求
	tool_calls?: ToolCall[];
};

// ============================================================================
// AI Response Types
// ============================================================================

/**
 * AI 响应完成原因
 */
export type FinishReason = "stop" | "tool_calls" | "length" | "error";

/**
 * AI 响应
 */
export type AIResponse = {
	message: ChatMessage;
	finish_reason: FinishReason;
	// 使用统计（可选）
	usage?: {
		prompt_tokens: number;
		completion_tokens: number;
		total_tokens: number;
	};
};

/**
 * 流式响应块
 */
export type AIStreamChunk = {
	delta: Partial<ChatMessage>;
	finish_reason?: FinishReason;
};

// ============================================================================
// Tool Format Types (用于 AI API)
// ============================================================================

/**
 * JSON Schema 类型
 */
export type JSONSchemaType =
	| "string"
	| "number"
	| "integer"
	| "boolean"
	| "object"
	| "array"
	| "null";

/**
 * JSON Schema 定义
 */
export type JSONSchema = {
	type: JSONSchemaType;
	description?: string;
	properties?: Record<string, JSONSchema>;
	required?: string[];
	items?: JSONSchema;
	enum?: (string | number | boolean)[];
	default?: unknown;
};

/**
 * OpenAI 工具格式
 */
export type OpenAITool = {
	type: "function";
	function: {
		name: string;
		description: string;
		parameters: {
			type: "object";
			properties: Record<string, JSONSchema>;
			required: string[];
		};
	};
};

/**
 * Anthropic 工具格式
 */
export type AnthropicTool = {
	name: string;
	description: string;
	input_schema: {
		type: "object";
		properties: Record<string, JSONSchema>;
		required: string[];
	};
};

// ============================================================================
// AI Client Interface
// ============================================================================

/**
 * AI 客户端配置
 */
export type AIClientConfig = {
	apiKey: string;
	model: string;
	baseUrl?: string;
	// 超时时间（毫秒）
	timeout?: number;
	// 最大重试次数
	maxRetries?: number;
};

/**
 * AI 客户端接口
 */
export type IAIClient = {
	/**
	 * 发送聊天请求
	 * @param messages 消息历史
	 * @param tools 可用工具（可选）
	 * @returns AI 响应
	 */
	chat(messages: ChatMessage[], tools?: OpenAITool[]): Promise<AIResponse>;

	/**
	 * 流式聊天请求
	 * @param messages 消息历史
	 * @param tools 可用工具（可选）
	 * @returns 流式响应迭代器
	 */
	streamChat?(
		messages: ChatMessage[],
		tools?: OpenAITool[],
	): AsyncIterable<AIStreamChunk>;

	/**
	 * 获取当前配置
	 */
	getConfig(): AIClientConfig;
};

// ============================================================================
// Tool Matcher Types
// ============================================================================

/**
 * 上下文信息（用于工具匹配）
 */
export type MatchContext = {
	// 当前工作目录
	cwd?: string;
	// 当前打开的文件
	currentFiles?: string[];
	// 项目类型检测结果
	projectType?: ProjectType;
	// 用户显式选择的文件
	selectedFiles?: string[];
};

/**
 * 项目类型
 */
export type ProjectType =
	| "node" // package.json
	| "python" // requirements.txt, pyproject.toml
	| "java" // pom.xml, build.gradle
	| "dotnet" // *.csproj, *.sln
	| "rust" // Cargo.toml
	| "go" // go.mod
	| "unknown";

/**
 * 匹配结果
 */
export type MatchResult = {
	tool: DiscoveredTool;
	action: ToolAction;
	// 匹配分数 (0-1)
	score: number;
	// 匹配原因
	reason: string;
};

/**
 * 工具匹配器接口
 */
export type IToolMatcher = {
	/**
	 * 根据查询匹配工具
	 * @param query 查询字符串
	 * @param context 上下文信息
	 * @returns 匹配的工具列表（按分数排序）
	 */
	match(query: string, context?: MatchContext): MatchResult[];

	/**
	 * 根据能力匹配工具
	 * @param capability 能力名称
	 */
	matchByCapability(capability: string): DiscoveredTool[];

	/**
	 * 根据项目上下文自动选择工具
	 * @param context 上下文信息
	 */
	autoSelect(context: MatchContext): DiscoveredTool[];
};

// ============================================================================
// Tool Call Handler Types
// ============================================================================

/**
 * 工具执行结果
 */
export type ToolExecutionResult = {
	success: boolean;
	output: string;
	error?: string;
	// 执行时间（毫秒）
	duration?: number;
};

/**
 * 工具调用处理器接口
 */
export type IToolCallHandler = {
	/**
	 * 处理 AI 返回的工具调用
	 * @param toolCalls 工具调用列表
	 * @returns 工具结果消息列表
	 */
	handleToolCalls(toolCalls: ToolCall[]): Promise<ChatMessage[]>;

	/**
	 * 解析工具调用名称
	 * @param name 工具调用名称 (格式: toolId_actionName)
	 * @returns 工具 ID 和动作名称
	 */
	parseToolCallName(name: string): { toolId: string; actionName: string };
};

// ============================================================================
// AI Service Types (两阶段调用)
// ============================================================================

/**
 * 第一阶段：分析用户意图，确定需要的工具
 */
export type IntentAnalysis = {
	// 需要的工具类型/能力
	requiredCapabilities: string[];
	// 是否需要工具
	needsTools: boolean;
	// 意图描述
	intent: string;
};

/**
 * AI 服务配置
 */
export type AIServiceConfig = {
	// AI 客户端
	client: IAIClient;
	// 是否启用两阶段调用
	twoPhaseEnabled?: boolean;
	// 最大工具调用轮数
	maxToolCallRounds?: number;
	// 是否启用上下文感知
	contextAwareEnabled?: boolean;
};

/**
 * AI 服务接口
 */
export type IAIService = {
	/**
	 * 发送消息并获取响应（自动处理工具调用循环）
	 * @param userMessage 用户消息
	 * @param context 上下文信息
	 * @returns 最终响应
	 */
	sendMessage(userMessage: string, context?: MatchContext): Promise<string>;

	/**
	 * 获取当前对话历史
	 */
	getHistory(): ChatMessage[];

	/**
	 * 清空对话历史
	 */
	clearHistory(): void;

	/**
	 * 设置系统提示词
	 */
	setSystemPrompt(prompt: string): void;
};
