import { describe, it, expect } from "vitest";
import {
	paramsToJsonSchema,
	toolToOpenAI,
	toOpenAITools,
	parseOpenAIToolCalls,
	buildOpenAIToolResultMessage,
	toOpenAIMessages,
} from "../../../../source/services/ai/adapters/openai.js";
import type { DiscoveredTool } from "../../../../source/services/tools/types.js";
import type { ChatMessage } from "../../../../source/services/ai/types.js";

describe("OpenAI Adapter", () => {
	describe("paramsToJsonSchema", () => {
		it("should convert string parameter to JSON schema", () => {
			const result = paramsToJsonSchema([
				{
					name: "testParam",
					type: "string",
					description: "A test parameter",
					required: true,
				},
			]);

			expect(result.type).toBe("object");
			expect(result.properties.testParam).toEqual({
				type: "string",
				description: "A test parameter",
			});
			expect(result.required).toContain("testParam");
		});

		it("should convert number parameter to JSON schema", () => {
			const result = paramsToJsonSchema([
				{
					name: "count",
					type: "number",
					description: "A count parameter",
					required: false,
				},
			]);

			expect(result.properties.count.type).toBe("number");
			expect(result.required).not.toContain("count");
		});

		it("should convert boolean parameter to JSON schema", () => {
			const result = paramsToJsonSchema([
				{
					name: "enabled",
					type: "boolean",
					description: "Enable flag",
					required: true,
				},
			]);

			expect(result.properties.enabled.type).toBe("boolean");
		});

		it("should convert file parameter to string type", () => {
			const result = paramsToJsonSchema([
				{
					name: "filepath",
					type: "file",
					description: "A file path",
					required: true,
				},
			]);

			expect(result.properties.filepath.type).toBe("string");
		});

		it("should convert directory parameter to string type", () => {
			const result = paramsToJsonSchema([
				{
					name: "dirpath",
					type: "directory",
					description: "A directory path",
					required: true,
				},
			]);

			expect(result.properties.dirpath.type).toBe("string");
		});

		it("should include default value when provided", () => {
			const result = paramsToJsonSchema([
				{
					name: "param",
					type: "string",
					description: "A parameter",
					required: false,
					default: "defaultValue",
				},
			]);

			expect(result.properties.param.default).toBe("defaultValue");
		});

		it("should handle empty parameters", () => {
			const result = paramsToJsonSchema([]);

			expect(result.type).toBe("object");
			expect(result.properties).toEqual({});
			expect(result.required).toEqual([]);
		});
	});

	describe("toolToOpenAI", () => {
		it("should return empty array for uninstalled tool", () => {
			const tool: DiscoveredTool = {
				id: "test-tool",
				name: "Test Tool",
				description: "A test tool",
				category: "shell",
				installed: false,
				actions: [],
			};

			const result = toolToOpenAI(tool);
			expect(result).toEqual([]);
		});

		it("should convert installed tool to OpenAI format", () => {
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

			const result = toolToOpenAI(tool);
			expect(result).toHaveLength(1);
			expect(result[0].type).toBe("function");
			expect(result[0].function.name).toBe("test-tool_action1");
			expect(result[0].function.description).toBe("[Test Tool] First action");
		});

		it("should handle tool with multiple actions", () => {
			const tool: DiscoveredTool = {
				id: "multi-tool",
				name: "Multi Tool",
				description: "A tool with multiple actions",
				category: "shell",
				installed: true,
				actions: [
					{
						name: "action1",
						description: "First action",
						parameters: [],
					},
					{
						name: "action2",
						description: "Second action",
						parameters: [],
					},
				],
			};

			const result = toolToOpenAI(tool);
			expect(result).toHaveLength(2);
			expect(result[0].function.name).toBe("multi-tool_action1");
			expect(result[1].function.name).toBe("multi-tool_action2");
		});
	});

	describe("toOpenAITools", () => {
		it("should convert multiple tools to OpenAI format", () => {
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
					installed: true,
					actions: [
						{
							name: "action",
							description: "Action",
							parameters: [],
						},
					],
				},
			];

			const result = toOpenAITools(tools);
			expect(result).toHaveLength(2);
		});

		it("should filter out uninstalled tools", () => {
			const tools: DiscoveredTool[] = [
				{
					id: "installed",
					name: "Installed Tool",
					description: "An installed tool",
					category: "shell",
					installed: true,
					actions: [{ name: "action", description: "Action", parameters: [] }],
				},
				{
					id: "uninstalled",
					name: "Uninstalled Tool",
					description: "An uninstalled tool",
					category: "shell",
					installed: false,
					actions: [{ name: "action", description: "Action", parameters: [] }],
				},
			];

			const result = toOpenAITools(tools);
			expect(result).toHaveLength(1);
			expect(result[0].function.name).toBe("installed_action");
		});
	});

	describe("parseOpenAIToolCalls", () => {
		it("should parse function tool calls", () => {
			const toolCalls = [
				{
					id: "call_123",
					type: "function",
					function: {
						name: "test_function",
						arguments: '{"param": "value"}',
					},
				},
			];

			const result = parseOpenAIToolCalls(toolCalls);
			expect(result).toHaveLength(1);
			expect(result[0].id).toBe("call_123");
			expect(result[0].type).toBe("function");
			expect(result[0].function.name).toBe("test_function");
			expect(result[0].function.arguments).toBe('{"param": "value"}');
		});

		it("should filter out non-function tool calls", () => {
			const toolCalls = [
				{
					id: "call_1",
					type: "function",
					function: {
						name: "func1",
						arguments: "{}",
					},
				},
				{
					id: "call_2",
					type: "other" as any,
					function: {
						name: "func2",
						arguments: "{}",
					},
				},
			];

			const result = parseOpenAIToolCalls(toolCalls);
			expect(result).toHaveLength(1);
			expect(result[0].id).toBe("call_1");
		});

		it("should handle empty tool calls", () => {
			const result = parseOpenAIToolCalls([]);
			expect(result).toEqual([]);
		});
	});

	describe("buildOpenAIToolResultMessage", () => {
		it("should build tool result message", () => {
			const result = buildOpenAIToolResultMessage("call_123", "Success");

			expect(result.role).toBe("tool");
			expect(result.tool_call_id).toBe("call_123");
			expect(result.content).toBe("Success");
		});

		it("should build error tool result message", () => {
			const result = buildOpenAIToolResultMessage(
				"call_123",
				"Something failed",
				true,
			);

			expect(result.role).toBe("tool");
			expect(result.content).toBe("Error: Something failed");
		});
	});

	describe("toOpenAIMessages", () => {
		it("should convert basic messages", () => {
			const messages: ChatMessage[] = [
				{ role: "user", content: "Hello" },
				{ role: "assistant", content: "Hi there" },
			];

			const result = toOpenAIMessages(messages);
			expect(result).toHaveLength(2);
			expect(result[0].role).toBe("user");
			expect(result[0].content).toBe("Hello");
			expect(result[1].role).toBe("assistant");
			expect(result[1].content).toBe("Hi there");
		});

		it("should include tool_call_id when present", () => {
			const messages: ChatMessage[] = [
				{
					role: "tool",
					content: "Tool result",
					tool_call_id: "call_123",
				},
			];

			const result = toOpenAIMessages(messages);
			expect(result[0].tool_call_id).toBe("call_123");
		});

		it("should include tool_calls when present", () => {
			const messages: ChatMessage[] = [
				{
					role: "assistant",
					content: "",
					tool_calls: [
						{
							id: "call_123",
							type: "function",
							function: {
								name: "test_func",
								arguments: '{"a": 1}',
							},
						},
					],
				},
			];

			const result = toOpenAIMessages(messages);
			expect(result[0].tool_calls).toBeDefined();
			expect(result[0].tool_calls?.[0].id).toBe("call_123");
			expect(result[0].tool_calls?.[0].function.name).toBe("test_func");
		});

		it("should not include tool_calls when empty", () => {
			const messages: ChatMessage[] = [
				{
					role: "assistant",
					content: "No tools",
					tool_calls: [],
				},
			];

			const result = toOpenAIMessages(messages);
			expect(result[0].tool_calls).toBeUndefined();
		});
	});
});
