# MCP 工具系统重构计划

## 一、现状分析

### 当前已实现

| 功能                | 状态      | 位置                                |
| ------------------- | --------- | ----------------------------------- |
| 工具自动发现        | ✅ 完成   | `discoverers/*.ts` (18个发现器)     |
| 工具注册表          | ✅ 完成   | `registry.ts`                       |
| 工具执行器          | ✅ 完成   | `executor.ts`                       |
| MCP Server (STDIO)  | ✅ 完成   | `mcp/server.ts`                     |
| In-Process Provider | ✅ 完成   | `mcp/inprocess.ts`                  |
| OpenAI Schema 转换  | ✅ 部分   | `executor.ts: paramsToJsonSchema()` |
| AI 集成             | ❌ 未实现 | `app.tsx` 仅有 TODO 占位            |
| 工具匹配            | ❌ 未实现 | 需要新增                            |

### 目标功能对照

| 目标                  | 现状          | 差距                |
| --------------------- | ------------- | ------------------- |
| a. 自动发现工具       | ✅ 已实现     | 无                  |
| b. AI工具需求匹配     | ❌ 未实现     | 需要设计匹配算法    |
| c. OpenAI协议格式转换 | ✅ 部分       | 需要完善 tools 格式 |
| d. Function Call执行  | ✅ 底层已实现 | 需要 AI 响应处理层  |

---

## 二、架构差距分析

### 当前架构

```
User Input → App → MessageOutput (显示)
                ↘ CommandHandler → ToolRegistry → Tool Execution
```

### 目标架构

```
User Input → App → AIClient → LLM API
                      ↓
              Tool Call Response
                      ↓
              ToolMatcher (匹配本地工具)
                      ↓
              ToolExecutor (执行)
                      ↓
              Result → AIClient (继续对话)
                      ↓
              Final Response → MessageOutput
```

---

## 三、缺失组件

### 1. AIClient (AI 客户端)

**职责**: 与 LLM API 通信

```typescript
// source/services/ai/client.ts
interface AIClient {
	chat(messages: Message[], tools?: Tool[]): Promise<AIResponse>;
	streamChat(messages: Message[], tools?: Tool[]): AsyncIterable<AIChunk>;
}
```

### 2. ToolMatcher (工具匹配器)

**职责**: 将 AI 请求的工具匹配到本地可用工具

```typescript
// source/services/tools/matcher.ts
interface ToolMatcher {
	// 根据 AI 描述匹配本地工具
	matchByDescription(description: string): DiscoveredTool[];

	// 根据能力匹配
	matchByCapability(capability: string): DiscoveredTool[];

	// 语义匹配 (可选，使用 embedding)
	semanticMatch(query: string): DiscoveredTool[];
}
```

### 3. ToolCallHandler (工具调用处理器)

**职责**: 处理 AI 返回的 function call

```typescript
// source/services/ai/tool-call-handler.ts
interface ToolCallHandler {
	// 解析 AI 返回的 tool_calls
	parseToolCalls(response: AIResponse): ToolCall[];

	// 执行工具调用
	executeToolCall(call: ToolCall): Promise<ToolResult>;

	// 构建工具结果消息
	buildToolResultMessage(results: ToolResult[]): Message;
}
```

### 4. OpenAI Tool Format Adapter

**职责**: 完整的 OpenAI tools 格式转换

```typescript
// source/services/ai/adapters/openai.ts
interface OpenAIAdapter {
	// 将 DiscoveredTool 转换为 OpenAI tools 格式
	toOpenAITools(tools: DiscoveredTool[]): OpenAI.Tool[];

	// 解析 OpenAI tool_calls 响应
	parseToolCalls(response: OpenAI.Response): ToolCall[];
}
```

---

## 四、重构方案

### Phase 1: 完善 OpenAI 协议支持

#### 1.1 创建 OpenAI Tool 格式适配器

```typescript
// source/services/ai/adapters/openai.ts

export interface OpenAITool {
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
}

export function toOpenAITools(registry: ToolRegistry): OpenAITool[] {
	const tools: OpenAITool[] = [];

	for (const tool of registry.getInstalled()) {
		for (const action of tool.actions) {
			tools.push({
				type: "function",
				function: {
					name: `${tool.id}_${action.name}`,
					description: `[${tool.name}] ${action.description}`,
					parameters: paramsToJsonSchema(action.parameters),
				},
			});
		}
	}

	return tools;
}
```

#### 1.2 创建 Anthropic Tool 格式适配器

```typescript
// source/services/ai/adapters/anthropic.ts

export interface AnthropicTool {
	name: string;
	description: string;
	input_schema: {
		type: "object";
		properties: Record<string, JSONSchema>;
		required: string[];
	};
}

export function toAnthropicTools(registry: ToolRegistry): AnthropicTool[] {
	// 类似 OpenAI，但字段名不同
}
```

### Phase 2: 实现 AI Client

#### 2.1 抽象 AI Client 接口

```typescript
// source/services/ai/types.ts

export interface ChatMessage {
	role: "user" | "assistant" | "system" | "tool";
	content: string;
	tool_call_id?: string;
	tool_calls?: ToolCall[];
}

export interface ToolCall {
	id: string;
	type: "function";
	function: {
		name: string;
		arguments: string; // JSON string
	};
}

export interface AIResponse {
	message: ChatMessage;
	finish_reason: "stop" | "tool_calls" | "length";
}

export interface AIClient {
	chat(messages: ChatMessage[], tools?: Tool[]): Promise<AIResponse>;
}
```

#### 2.2 实现 OpenAI Client

```typescript
// source/services/ai/clients/openai.ts

export class OpenAIClient implements AIClient {
	constructor(
		private config: { apiKey: string; model: string; baseUrl?: string },
	) {}

	async chat(messages: ChatMessage[], tools?: Tool[]): Promise<AIResponse> {
		const response = await fetch(`${this.config.baseUrl}/v1/chat/completions`, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${this.config.apiKey}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				model: this.config.model,
				messages,
				tools: tools ? toOpenAITools(tools) : undefined,
				tool_choice: tools ? "auto" : undefined,
			}),
		});

		return this.parseResponse(await response.json());
	}
}
```

### Phase 3: 实现工具匹配器

#### 3.1 基础匹配器 (关键词 + 类别)

```typescript
// source/services/tools/matcher.ts

export class ToolMatcher {
	constructor(private registry: ToolRegistry) {}

	// 关键词映射表
	private keywordMap: Record<string, string[]> = {
		git: ["git", "version control", "commit", "branch", "merge"],
		bc4: ["beyond compare", "diff", "compare", "merge files"],
		node: ["node", "nodejs", "npm", "javascript", "js"],
		python: ["python", "pip", "py"],
		// ...
	};

	// 能力到工具的映射
	private capabilityMap: Record<string, ToolCapability> = {
		"compare files": "diff",
		"merge files": "merge",
		"run code": "execute",
		"build project": "build",
		// ...
	};

	matchByKeywords(query: string): DiscoveredTool[] {
		const queryLower = query.toLowerCase();
		const matched: DiscoveredTool[] = [];

		for (const [toolId, keywords] of Object.entries(this.keywordMap)) {
			if (keywords.some((kw) => queryLower.includes(kw))) {
				const tool = this.registry.getTool(toolId);
				if (tool?.installed) {
					matched.push(tool);
				}
			}
		}

		return matched;
	}

	matchByCapability(capability: string): DiscoveredTool[] {
		const cap = this.capabilityMap[capability.toLowerCase()];
		if (!cap) return [];
		return this.registry.getByCapability(cap);
	}
}
```

#### 3.2 AI 辅助匹配 (高级方案)

```typescript
// source/services/tools/ai-matcher.ts

export class AIToolMatcher {
	constructor(
		private registry: ToolRegistry,
		private aiClient: AIClient,
	) {}

	async matchTools(userQuery: string): Promise<DiscoveredTool[]> {
		// 构建 prompt 让 AI 分析需要什么工具
		const availableTools = this.registry.getInstalled().map((t) => ({
			id: t.id,
			name: t.name,
			description: t.description,
			capabilities: t.capabilities,
		}));

		const systemPrompt = `你是一个工具选择助手。用户会描述他们的需求，你需要从可用工具列表中选择最合适的工具。

可用工具:
${JSON.stringify(availableTools, null, 2)}

请只返回工具 ID 列表，用逗号分隔。如果没有合适的工具，返回空字符串。`;

		const response = await this.aiClient.chat([
			{ role: "system", content: systemPrompt },
			{ role: "user", content: userQuery },
		]);

		const toolIds = response.message.content.split(",").map((s) => s.trim());
		return toolIds
			.map((id) => this.registry.getTool(id))
			.filter((t): t is DiscoveredTool => t !== undefined && t.installed);
	}
}
```

### Phase 4: 实现工具调用处理

```typescript
// source/services/ai/tool-call-handler.ts

export class ToolCallHandler {
	constructor(private registry: ToolRegistry) {}

	async handleToolCalls(toolCalls: ToolCall[]): Promise<ChatMessage[]> {
		const results: ChatMessage[] = [];

		for (const call of toolCalls) {
			const [toolId, actionName] = call.function.name.split("_");
			const tool = this.registry.getTool(toolId);

			if (!tool) {
				results.push({
					role: "tool",
					tool_call_id: call.id,
					content: `Error: Tool "${toolId}" not found`,
				});
				continue;
			}

			const action = tool.actions.find((a) => a.name === actionName);
			if (!action) {
				results.push({
					role: "tool",
					tool_call_id: call.id,
					content: `Error: Action "${actionName}" not found in tool "${toolId}"`,
				});
				continue;
			}

			const args = JSON.parse(call.function.arguments);
			const result = await executeToolAction(tool, action, args);

			results.push({
				role: "tool",
				tool_call_id: call.id,
				content: result.success
					? result.stdout
					: `Error: ${result.error || result.stderr}`,
			});
		}

		return results;
	}
}
```

### Phase 5: 集成到 App

```typescript
// source/app.tsx

export default function App() {
	const [aiClient, setAIClient] = useState<AIClient | null>(null);
	const [messages, setMessages] = useState<Message[]>([]);
	const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);

	const toolRegistry = useMemo(() => getToolRegistry(), []);
	const toolCallHandler = useMemo(
		() => new ToolCallHandler(toolRegistry),
		[toolRegistry],
	);

	const sendToAI = useCallback(
		async (content: string) => {
			if (!aiClient) {
				setMessages((prev) => [...prev, { content: "请先选择 AI 模型" }]);
				return;
			}

			// 添加用户消息
			setMessages((prev) => [...prev, { content, type: "user" }]);
			const newHistory = [...chatHistory, { role: "user" as const, content }];

			// 获取可用工具
			const tools = toOpenAITools(toolRegistry);

			// 发送到 AI
			let response = await aiClient.chat(newHistory, tools);

			// 处理 tool calls 循环
			while (
				response.finish_reason === "tool_calls" &&
				response.message.tool_calls
			) {
				// 执行工具调用
				const toolResults = await toolCallHandler.handleToolCalls(
					response.message.tool_calls,
				);

				// 显示工具执行结果
				for (const result of toolResults) {
					setMessages((prev) => [
						...prev,
						{
							content: `🔧 ${result.content}`,
							type: "system",
						},
					]);
				}

				// 继续对话
				newHistory.push(response.message, ...toolResults);
				response = await aiClient.chat(newHistory, tools);
			}

			// 显示最终响应
			setChatHistory([...newHistory, response.message]);
			setMessages((prev) => [...prev, { content: response.message.content }]);
		},
		[aiClient, chatHistory, toolCallHandler, toolRegistry],
	);

	// ...
}
```

---

## 五、推荐的工业实践参考

### 1. LangChain 方案

LangChain 使用 Tool 抽象和 Agent 模式：

- `Tool` 类定义工具接口
- `Agent` 类管理工具选择和执行循环
- 支持多种 LLM provider

### 2. OpenAI Assistants API

- 内置 tool_calls 处理
- 支持多轮工具调用
- 自动管理对话状态

### 3. Anthropic Claude Tool Use

- `tools` 参数传递工具定义
- `tool_use` 消息类型处理工具调用
- `tool_result` 消息返回结果

### 4. Vercel AI SDK

- 统一的 `tool` 接口
- `useChat` hook 内置工具处理
- 流式响应支持

---

## 六、实现优先级

### P0 (必须)

1. ✅ OpenAI/Anthropic Tool 格式适配器
2. ✅ AI Client 抽象接口
3. ✅ Tool Call Handler
4. ✅ App 集成

### P1 (重要)

1. 🔲 基础关键词匹配器
2. 🔲 配置持久化
3. 🔲 错误处理和重试
4. 🔲 流式响应支持

### P2 (增强)

1. 🔲 AI 辅助工具匹配
2. 🔲 工具执行结果缓存
3. 🔲 工具权限控制
4. 🔲 执行历史记录

---

## 七、文件结构建议

```
source/services/
├── ai/
│   ├── types.ts           # AI 相关类型定义
│   ├── client.ts          # AIClient 接口
│   ├── tool-call-handler.ts
│   ├── adapters/
│   │   ├── openai.ts      # OpenAI 格式适配
│   │   ├── anthropic.ts   # Anthropic 格式适配
│   │   └── index.ts
│   └── clients/
│       ├── openai.ts      # OpenAI 客户端实现
│       ├── anthropic.ts   # Anthropic 客户端实现
│       └── index.ts
├── tools/
│   ├── types.ts           # (已有)
│   ├── registry.ts        # (已有)
│   ├── executor.ts        # (已有)
│   ├── matcher.ts         # 新增: 工具匹配器
│   ├── discoverers/       # (已有)
│   └── mcp/               # (已有)
└── config/
    └── ai-config.ts       # AI 配置管理
```

---

## 八、总结

当前架构已经具备了坚实的基础：

- ✅ 工具发现和注册机制完善
- ✅ 工具执行器可用
- ✅ MCP Server 可用
- ✅ OpenAI Schema 转换部分实现

主要差距在于：

- ❌ 缺少 AI Client 层
- ❌ 缺少 Tool Call 处理循环
- ❌ 缺少工具匹配逻辑
- ❌ 缺少多 Provider 支持

重构工作量估计：

- Phase 1 (协议适配): ~2-3 小时
- Phase 2 (AI Client): ~4-6 小时
- Phase 3 (工具匹配): ~2-3 小时
- Phase 4 (调用处理): ~2-3 小时
- Phase 5 (App 集成): ~3-4 小时

总计: ~15-20 小时开发工作
