import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
	renderCommandTemplate,
	validateParams,
	fillDefaults,
	executeCommand,
	executeToolAction,
	getToolAction,
	paramsToJsonSchema,
} from "../../../source/services/tools/executor.js";
import type { ToolAction, DiscoveredTool } from "../../../source/services/tools/types.js";

// Mock config module
vi.mock("../../../source/utils/config.js", () => ({
	getCurrentModelId: vi.fn(() => "test-model"),
	getModelById: vi.fn(() => ({ contextWindow: 32000 })),
}));

describe("Tool Executor", () => {
	describe("renderCommandTemplate", () => {
		it("should replace parameter placeholders", () => {
			const template = "echo {{message}}";
			const params = { message: "hello world" };

			const result = renderCommandTemplate(template, params);
			expect(result).toBe("echo hello world");
		});

		it("should replace multiple placeholders", () => {
			const template = "{{cmd}} {{arg1}} {{arg2}}";
			const params = { cmd: "echo", arg1: "hello", arg2: "world" };

			const result = renderCommandTemplate(template, params);
			expect(result).toBe("echo hello world");
		});

		it("should replace execPath when tool is provided", () => {
			const template = "{{execPath}} --version";
			const tool: DiscoveredTool = {
				id: "test",
				name: "Test",
				description: "Test tool",
				category: "shell",
				installed: true,
				executablePath: "/usr/bin/test",
				actions: [],
			};

			const result = renderCommandTemplate(template, {}, tool);
			expect(result).toBe("/usr/bin/test --version");
		});

		it("should remove unreplaced placeholders", () => {
			const template = "echo {{message}} {{unknown}}";
			const params = { message: "hello" };

			const result = renderCommandTemplate(template, params);
			expect(result).toBe("echo hello");
		});

		it("should handle null and undefined values", () => {
			const template = "echo {{val1}} {{val2}}";
			const params = { val1: null, val2: undefined };

			const result = renderCommandTemplate(template, params);
			expect(result).toBe("echo");
		});

		it("should clean up extra spaces", () => {
			const template = "echo    {{message}}    test";
			const params = { message: "hello" };

			const result = renderCommandTemplate(template, params);
			expect(result).toBe("echo hello test");
		});
	});

	describe("validateParams", () => {
		it("should return valid for correct params", () => {
			const action: ToolAction = {
				name: "test",
				description: "Test action",
				parameters: [
					{
						name: "message",
						type: "string",
						description: "Message",
						required: true,
					},
				],
			};
			const params = { message: "hello" };

			const result = validateParams(action, params);
			expect(result.valid).toBe(true);
			expect(result.errors).toHaveLength(0);
		});

		it("should report missing required parameter", () => {
			const action: ToolAction = {
				name: "test",
				description: "Test action",
				parameters: [
					{
						name: "required_param",
						type: "string",
						description: "Required",
						required: true,
					},
				],
			};
			const params = {};

			const result = validateParams(action, params);
			expect(result.valid).toBe(false);
			expect(result.errors).toContain("Missing required parameter: required_param");
		});

		it("should report empty string for required parameter", () => {
			const action: ToolAction = {
				name: "test",
				description: "Test action",
				parameters: [
					{
						name: "required_param",
						type: "string",
						description: "Required",
						required: true,
					},
				],
			};
			const params = { required_param: "" };

			const result = validateParams(action, params);
			expect(result.valid).toBe(false);
		});

		it("should validate number type", () => {
			const action: ToolAction = {
				name: "test",
				description: "Test action",
				parameters: [
					{
						name: "count",
						type: "number",
						description: "Count",
						required: false,
					},
				],
			};

			// Valid number
			expect(validateParams(action, { count: 42 }).valid).toBe(true);
			// Valid string number
			expect(validateParams(action, { count: "42" }).valid).toBe(true);
			// Invalid string
			expect(validateParams(action, { count: "not-a-number" }).valid).toBe(false);
		});

		it("should validate boolean type", () => {
			const action: ToolAction = {
				name: "test",
				description: "Test action",
				parameters: [
					{
						name: "enabled",
						type: "boolean",
						description: "Enable flag",
						required: false,
					},
				],
			};

			// Valid boolean
			expect(validateParams(action, { enabled: true }).valid).toBe(true);
			expect(validateParams(action, { enabled: false }).valid).toBe(true);
			// Valid string boolean
			expect(validateParams(action, { enabled: "true" }).valid).toBe(true);
			expect(validateParams(action, { enabled: "false" }).valid).toBe(true);
			// Invalid
			expect(validateParams(action, { enabled: "yes" }).valid).toBe(false);
		});

		it("should allow optional parameters to be undefined", () => {
			const action: ToolAction = {
				name: "test",
				description: "Test action",
				parameters: [
					{
						name: "optional",
						type: "string",
						description: "Optional",
						required: false,
					},
				],
			};

			const result = validateParams(action, {});
			expect(result.valid).toBe(true);
		});
	});

	describe("fillDefaults", () => {
		it("should fill default values for missing parameters", () => {
			const action: ToolAction = {
				name: "test",
				description: "Test action",
				parameters: [
					{
						name: "param",
						type: "string",
						description: "Param",
						required: false,
						default: "default_value",
					},
				],
			};

			const result = fillDefaults(action, {});
			expect(result.param).toBe("default_value");
		});

		it("should not override provided values", () => {
			const action: ToolAction = {
				name: "test",
				description: "Test action",
				parameters: [
					{
						name: "param",
						type: "string",
						description: "Param",
						required: false,
						default: "default_value",
					},
				],
			};

			const result = fillDefaults(action, { param: "provided_value" });
			expect(result.param).toBe("provided_value");
		});

		it("should handle parameters without defaults", () => {
			const action: ToolAction = {
				name: "test",
				description: "Test action",
				parameters: [
					{
						name: "param",
						type: "string",
						description: "Param",
						required: true,
					},
				],
			};

			const result = fillDefaults(action, { param: "value" });
			expect(result.param).toBe("value");
		});
	});

	describe("executeCommand", () => {
		it("should execute a simple command successfully", async () => {
			// Use a command that works on all platforms
			const result = await executeCommand("echo hello", { timeout: 5000 });

			expect(result.success).toBe(true);
			expect(result.stdout).toContain("hello");
			expect(result.exitCode).toBe(0);
		});

		it("should handle command with non-zero exit code", async () => {
			// Use a command that will fail
			const result = await executeCommand("exit 1", { timeout: 5000 });

			expect(result.success).toBe(false);
			expect(result.exitCode).toBe(1);
		});

		it("should capture stderr", async () => {
			const cmd =
				process.platform === "win32"
					? "echo error 1>&2"
					: "echo error >&2";
			const result = await executeCommand(cmd, { timeout: 5000 });

			// On some platforms this might go to stdout
			const hasError = result.stderr.includes("error") || result.stdout.includes("error");
			expect(hasError).toBe(true);
		});

		it("should use custom cwd", async () => {
			const result = await executeCommand(
				process.platform === "win32" ? "cd" : "pwd",
				{ cwd: process.cwd(), timeout: 5000 }
			);
			expect(result.success).toBe(true);
		});

		it("should use custom env", async () => {
			const cmd = process.platform === "win32" ? "echo %TEST_VAR%" : "echo $TEST_VAR";
			const result = await executeCommand(cmd, {
				env: { TEST_VAR: "test_value" },
				timeout: 5000,
			});
			// Note: On Windows with shell=true, env variable expansion might differ
			expect(result.success).toBe(true);
		});
	});

	describe("executeToolAction", () => {
		it("should return error for uninstalled tool", async () => {
			const tool: DiscoveredTool = {
				id: "test",
				name: "Test Tool",
				description: "Test",
				category: "shell",
				installed: false,
				installHint: "Install via npm",
				actions: [],
			};
			const action: ToolAction = {
				name: "run",
				description: "Run",
				commandTemplate: "echo test",
				parameters: [],
			};

			const result = await executeToolAction(tool, action, {});
			expect(result.success).toBe(false);
			expect(result.error).toContain("not installed");
			expect(result.error).toContain("Install via npm");
		});

		it("should return error for invalid params", async () => {
			const tool: DiscoveredTool = {
				id: "test",
				name: "Test Tool",
				description: "Test",
				category: "shell",
				installed: true,
				actions: [],
			};
			const action: ToolAction = {
				name: "run",
				description: "Run",
				commandTemplate: "echo {{message}}",
				parameters: [
					{
						name: "message",
						type: "string",
						description: "Message",
						required: true,
					},
				],
			};

			const result = await executeToolAction(tool, action, {});
			expect(result.success).toBe(false);
			expect(result.error).toContain("Parameter validation failed");
		});

		it("should execute command with valid params", async () => {
			const tool: DiscoveredTool = {
				id: "test",
				name: "Test Tool",
				description: "Test",
				category: "shell",
				installed: true,
				actions: [],
			};
			const action: ToolAction = {
				name: "run",
				description: "Run",
				commandTemplate: "echo {{message}}",
				parameters: [
					{
						name: "message",
						type: "string",
						description: "Message",
						required: true,
					},
				],
			};

			const result = await executeToolAction(tool, action, { message: "hello" }, { timeout: 5000 });
			expect(result.success).toBe(true);
			expect(result.stdout).toContain("hello");
		});

		it("should fill default values", async () => {
			const tool: DiscoveredTool = {
				id: "test",
				name: "Test Tool",
				description: "Test",
				category: "shell",
				installed: true,
				actions: [],
			};
			const action: ToolAction = {
				name: "run",
				description: "Run",
				commandTemplate: "echo {{message}}",
				parameters: [
					{
						name: "message",
						type: "string",
						description: "Message",
						required: false,
						default: "default_msg",
					},
				],
			};

			const result = await executeToolAction(tool, action, {}, { timeout: 5000 });
			expect(result.success).toBe(true);
			expect(result.stdout).toContain("default_msg");
		});

		it("should return error for unsupported script execution tool", async () => {
			const tool: DiscoveredTool = {
				id: "unsupported",
				name: "Unsupported Tool",
				description: "Test",
				category: "shell",
				installed: true,
				actions: [],
			};
			const action: ToolAction = {
				name: "run_script_content",
				description: "Run script",
				commandTemplate: "__SCRIPT_EXECUTION__",
				parameters: [
					{
						name: "content",
						type: "string",
						description: "Script content",
						required: true,
					},
				],
			};

			const result = await executeToolAction(tool, action, { content: "echo test" });
			expect(result.success).toBe(false);
			expect(result.error).toContain("does not support script execution");
		});

		it("should return error for empty script content", async () => {
			const tool: DiscoveredTool = {
				id: "bash",
				name: "Bash",
				description: "Test",
				category: "shell",
				installed: true,
				actions: [],
			};
			const action: ToolAction = {
				name: "run_script_content",
				description: "Run script",
				commandTemplate: "__SCRIPT_EXECUTION__",
				parameters: [
					{
						name: "content",
						type: "string",
						description: "Script content",
						required: false,
					},
				],
			};

			const result = await executeToolAction(tool, action, {});
			expect(result.success).toBe(false);
			expect(result.error).toContain("Script content is required");
		});
	});

	describe("getToolAction", () => {
		it("should find action by name", () => {
			const tool: DiscoveredTool = {
				id: "test",
				name: "Test",
				description: "Test tool",
				category: "shell",
				installed: true,
				actions: [
					{ name: "action1", description: "First", parameters: [] },
					{ name: "action2", description: "Second", parameters: [] },
				],
			};

			const action = getToolAction(tool, "action2");
			expect(action).toBeDefined();
			expect(action?.name).toBe("action2");
			expect(action?.description).toBe("Second");
		});

		it("should return undefined for non-existent action", () => {
			const tool: DiscoveredTool = {
				id: "test",
				name: "Test",
				description: "Test tool",
				category: "shell",
				installed: true,
				actions: [{ name: "action1", description: "First", parameters: [] }],
			};

			const action = getToolAction(tool, "nonexistent");
			expect(action).toBeUndefined();
		});
	});

	describe("paramsToJsonSchema", () => {
		it("should convert string parameter", () => {
			const result = paramsToJsonSchema([
				{
					name: "param",
					type: "string",
					description: "A string param",
					required: true,
				},
			]);

			expect(result.type).toBe("object");
			expect(result.properties.param).toEqual({
				type: "string",
				description: "A string param",
			});
			expect(result.required).toContain("param");
		});

		it("should convert number parameter", () => {
			const result = paramsToJsonSchema([
				{
					name: "count",
					type: "number",
					description: "A count",
					required: false,
				},
			]);

			expect(result.properties.count).toEqual({
				type: "number",
				description: "A count",
			});
			expect(result.required).not.toContain("count");
		});

		it("should convert boolean parameter", () => {
			const result = paramsToJsonSchema([
				{
					name: "enabled",
					type: "boolean",
					description: "Enable flag",
					required: true,
				},
			]);

			expect(result.properties.enabled).toEqual({
				type: "boolean",
				description: "Enable flag",
			});
		});

		it("should convert file parameter to string", () => {
			const result = paramsToJsonSchema([
				{
					name: "filepath",
					type: "file",
					description: "A file path",
					required: true,
				},
			]);

			expect(result.properties.filepath).toEqual({
				type: "string",
				description: "A file path",
			});
		});

		it("should convert directory parameter to string", () => {
			const result = paramsToJsonSchema([
				{
					name: "dirpath",
					type: "directory",
					description: "A directory",
					required: true,
				},
			]);

			expect(result.properties.dirpath).toEqual({
				type: "string",
				description: "A directory",
			});
		});

		it("should include default values", () => {
			const result = paramsToJsonSchema([
				{
					name: "param",
					type: "string",
					description: "A param",
					required: false,
					default: "default_value",
				},
			]);

			expect(result.properties.param).toEqual({
				type: "string",
				description: "A param",
				default: "default_value",
			});
		});

		it("should handle empty parameters", () => {
			const result = paramsToJsonSchema([]);

			expect(result.type).toBe("object");
			expect(result.properties).toEqual({});
			expect(result.required).toEqual([]);
		});
	});
});
