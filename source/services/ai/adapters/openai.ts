/**
 * OpenAI 工具格式适配器
 * 将本地 DiscoveredTool 转换为 OpenAI Function Calling 格式
 */

import type { DiscoveredTool, ToolParameter } from "../../tools/types.js";
import type {
	OpenAITool,
	JSONSchema,
	ToolCall,
	ChatMessage,
} from "../types.js";

/**
 * 将 ToolParameter 类型转换为 JSON Schema 类型
 */
function paramTypeToJsonSchema(param: ToolParameter): JSONSchema {
	const baseSchema: JSONSchema = {
		type: "string",
		description: param.description,
	};

	switch (param.type) {
		case "string":
		case "file":
		case "directory":
			baseSchema.type = "string";
			break;
		case "number":
			baseSchema.type = "number";
			break;
		case "boolean":
			baseSchema.type = "boolean";
			break;
		default:
			baseSchema.type = "string";
	}

	if (param.default !== undefined) {
		baseSchema.default = param.default;
	}

	return baseSchema;
}

/**
 * 将参数列表转换为 JSON Schema
 */
export function paramsToJsonSchema(params: ToolParameter[]): {
	type: "object";
	properties: Record<string, JSONSchema>;
	required: string[];
} {
	const properties: Record<string, JSONSchema> = {};
	const required: string[] = [];

	for (const param of params) {
		properties[param.name] = paramTypeToJsonSchema(param);
		if (param.required) {
			required.push(param.name);
		}
	}

	return {
		type: "object",
		properties,
		required,
	};
}

/**
 * 将单个 DiscoveredTool 转换为 OpenAI 工具格式
 * 每个 action 对应一个 function
 */
export function toolToOpenAI(tool: DiscoveredTool): OpenAITool[] {
	if (!tool.installed) {
		return [];
	}

	return tool.actions.map((action) => ({
		type: "function" as const,
		function: {
			name: `${tool.id}_${action.name}`,
			description: `[${tool.name}] ${action.description}`,
			parameters: paramsToJsonSchema(action.parameters),
		},
	}));
}

/**
 * 将 DiscoveredTool 数组转换为 OpenAI 工具格式
 */
export function toOpenAITools(tools: DiscoveredTool[]): OpenAITool[] {
	return tools.flatMap(toolToOpenAI);
}

/**
 * 解析 OpenAI 响应中的 tool_calls
 */
export function parseOpenAIToolCalls(
	toolCalls: Array<{
		id: string;
		type: string;
		function: {
			name: string;
			arguments: string;
		};
	}>,
): ToolCall[] {
	return toolCalls
		.filter((tc) => tc.type === "function")
		.map((tc) => ({
			id: tc.id,
			type: "function" as const,
			function: {
				name: tc.function.name,
				arguments: tc.function.arguments,
			},
		}));
}

/**
 * 构建 OpenAI 格式的工具结果消息
 */
export function buildOpenAIToolResultMessage(
	toolCallId: string,
	content: string,
	isError = false,
): ChatMessage {
	return {
		role: "tool",
		tool_call_id: toolCallId,
		content: isError ? `Error: ${content}` : content,
	};
}

/**
 * 将聊天消息转换为 OpenAI API 格式
 */
export function toOpenAIMessages(messages: ChatMessage[]): Array<{
	role: string;
	content: string;
	tool_call_id?: string;
	tool_calls?: Array<{
		id: string;
		type: string;
		function: {
			name: string;
			arguments: string;
		};
	}>;
}> {
	return messages.map((msg) => {
		const base: {
			role: string;
			content: string;
			tool_call_id?: string;
			tool_calls?: Array<{
				id: string;
				type: string;
				function: { name: string; arguments: string };
			}>;
		} = {
			role: msg.role,
			content: msg.content,
		};

		if (msg.tool_call_id) {
			base.tool_call_id = msg.tool_call_id;
		}

		if (msg.tool_calls && msg.tool_calls.length > 0) {
			base.tool_calls = msg.tool_calls.map((tc) => ({
				id: tc.id,
				type: tc.type,
				function: {
					name: tc.function.name,
					// 确保 arguments 是有效的 JSON 字符串，空字符串替换为 "{}"
					// 某些 API（如 Qwen）要求 arguments 必须是有效 JSON
					arguments: tc.function.arguments || "{}",
				},
			}));
		}

		return base;
	});
}
