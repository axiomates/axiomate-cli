import { describe, it, expect } from "vitest";
import {
	toolToAnthropic,
	toAnthropicTools,
	parseAnthropicToolUse,
	buildAnthropicToolResultMessage,
	toAnthropicMessages,
	extractSystemMessage,
} from "../../../../source/services/ai/adapters/anthropic.js";
import type { DiscoveredTool } from "../../../../source/services/tools/types.js";
import type { ChatMessage } from "../../../../source/services/ai/types.js";

describe("Anthropic Adapter", () => {
	describe("toolToAnthropic", () => {
		it("should return empty array for uninstalled tool", () => {
			const tool: DiscoveredTool = {
				id: "test-tool",
				name: "Test Tool",
				description: "A test tool",
				category: "shell",
				installed: false,
				actions: [],
			};

			const result = toolToAnthropic(tool);
			expect(result).toEqual([]);
		});

		it("should convert installed tool to Anthropic format", () => {
			const tool: DiscoveredTool = {
				id: "test-tool",
				name: "Test Tool",
				description: "A test tool",
				category: "shell",
				installed: true,
				actions: [
					{
						name: "action1",
						description: "First action",
						parameters: [
							{
								name: "param1",
								type: "string",
								description: "First param",
								required: true,
							},
						],
					},
				],
			};

			const result = toolToAnthropic(tool);
			expect(result).toHaveLength(1);
			expect(result[0].name).toBe("test-tool_action1");
			expect(result[0].description).toBe("[Test Tool] First action");
			expect(result[0].input_schema).toBeDefined();
		});
	});

	describe("toAnthropicTools", () => {
		it("should convert multiple tools to Anthropic format", () => {
			const tools: DiscoveredTool[] = [
				{
					id: "tool1",
					name: "Tool 1",
					description: "First tool",
					category: "shell",
					installed: true,
					actions: [
						{
							name: "action",
							description: "Action",
							parameters: [],
						},
					],
				},
				{
					id: "tool2",
					name: "Tool 2",
					description: "Second tool",
					category: "ide",
					installed: false,
					actions: [],
				},
			];

			const result = toAnthropicTools(tools);
			expect(result).toHaveLength(1);
		});
	});

	describe("parseAnthropicToolUse", () => {
		it("should parse tool_use blocks", () => {
			const contentBlocks = [
				{
					type: "tool_use",
					id: "tool_123",
					name: "test_function",
					input: { param: "value" },
				},
			];

			const result = parseAnthropicToolUse(contentBlocks);
			expect(result).toHaveLength(1);
			expect(result[0].id).toBe("tool_123");
			expect(result[0].type).toBe("function");
			expect(result[0].function.name).toBe("test_function");
			expect(result[0].function.arguments).toBe('{"param":"value"}');
		});

		it("should filter out non-tool_use blocks", () => {
			const contentBlocks = [
				{
					type: "text",
					text: "Some text",
				},
				{
					type: "tool_use",
					id: "tool_123",
					name: "func1",
					input: {},
				},
			];

			const result = parseAnthropicToolUse(contentBlocks);
			expect(result).toHaveLength(1);
			expect(result[0].id).toBe("tool_123");
		});

		it("should handle empty content blocks", () => {
			const result = parseAnthropicToolUse([]);
			expect(result).toEqual([]);
		});
	});

	describe("buildAnthropicToolResultMessage", () => {
		it("should build tool result message", () => {
			const result = buildAnthropicToolResultMessage("tool_123", "Success");

			expect(result.role).toBe("tool");
			expect(result.tool_call_id).toBe("tool_123");
			expect(result.content).toBe("Success");
		});

		it("should build error tool result message", () => {
			const result = buildAnthropicToolResultMessage(
				"tool_123",
				"Something failed",
				true,
			);

			expect(result.role).toBe("tool");
			expect(result.content).toBe("Error: Something failed");
		});
	});

	describe("toAnthropicMessages", () => {
		it("should convert basic messages", () => {
			const messages: ChatMessage[] = [
				{ role: "user", content: "Hello" },
				{ role: "assistant", content: "Hi there" },
			];

			const result = toAnthropicMessages(messages);
			expect(result).toHaveLength(2);
			expect(result[0].role).toBe("user");
			expect(result[0].content).toBe("Hello");
			expect(result[1].role).toBe("assistant");
			expect(result[1].content).toBe("Hi there");
		});

		it("should skip system messages", () => {
			const messages: ChatMessage[] = [
				{ role: "system", content: "You are a helpful assistant" },
				{ role: "user", content: "Hello" },
			];

			const result = toAnthropicMessages(messages);
			expect(result).toHaveLength(1);
			expect(result[0].role).toBe("user");
		});

		it("should convert tool messages to user messages with tool_result", () => {
			const messages: ChatMessage[] = [
				{ role: "user", content: "Run tool" },
				{
					role: "assistant",
					content: "",
					tool_calls: [
						{
							id: "tool_123",
							type: "function",
							function: {
								name: "test_func",
								arguments: '{"a": 1}',
							},
						},
					],
				},
				{
					role: "tool",
					content: "Tool result",
					tool_call_id: "tool_123",
				},
				{ role: "assistant", content: "Done" },
			];

			const result = toAnthropicMessages(messages);
			expect(result).toHaveLength(4);
			// First is user message
			expect(result[0].role).toBe("user");
			// Second is assistant with tool_use
			expect(result[1].role).toBe("assistant");
			expect(Array.isArray(result[1].content)).toBe(true);
			// Third is user message with tool_result
			expect(result[2].role).toBe("user");
			const toolResultContent = result[2].content as Array<{
				type: string;
				tool_use_id?: string;
				content?: string;
			}>;
			expect(toolResultContent[0].type).toBe("tool_result");
			expect(toolResultContent[0].tool_use_id).toBe("tool_123");
		});

		it("should handle assistant messages with text and tool_calls", () => {
			const messages: ChatMessage[] = [
				{ role: "user", content: "Hello" },
				{
					role: "assistant",
					content: "I will call a tool",
					tool_calls: [
						{
							id: "tool_123",
							type: "function",
							function: {
								name: "test_func",
								arguments: '{}',
							},
						},
					],
				},
			];

			const result = toAnthropicMessages(messages);
			expect(result).toHaveLength(2);
			const assistantContent = result[1].content as Array<{
				type: string;
				text?: string;
				id?: string;
				name?: string;
			}>;
			expect(assistantContent).toHaveLength(2);
			expect(assistantContent[0].type).toBe("text");
			expect(assistantContent[0].text).toBe("I will call a tool");
			expect(assistantContent[1].type).toBe("tool_use");
		});

		it("should handle trailing tool results", () => {
			const messages: ChatMessage[] = [
				{ role: "user", content: "Hello" },
				{
					role: "assistant",
					content: "",
					tool_calls: [
						{
							id: "tool_123",
							type: "function",
							function: {
								name: "test_func",
								arguments: '{}',
							},
						},
					],
				},
				{
					role: "tool",
					content: "Result",
					tool_call_id: "tool_123",
				},
			];

			const result = toAnthropicMessages(messages);
			// Should have user, assistant (with tool_use), user (with tool_result)
			expect(result).toHaveLength(3);
			expect(result[2].role).toBe("user");
		});
	});

	describe("extractSystemMessage", () => {
		it("should extract system message content", () => {
			const messages: ChatMessage[] = [
				{ role: "system", content: "You are a helpful assistant" },
				{ role: "user", content: "Hello" },
			];

			const result = extractSystemMessage(messages);
			expect(result).toBe("You are a helpful assistant");
		});

		it("should return undefined when no system message", () => {
			const messages: ChatMessage[] = [
				{ role: "user", content: "Hello" },
				{ role: "assistant", content: "Hi" },
			];

			const result = extractSystemMessage(messages);
			expect(result).toBeUndefined();
		});
	});
});
