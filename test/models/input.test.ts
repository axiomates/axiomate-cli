import { describe, expect, it } from "vitest";
import {
	isMessageInput,
	isCommandInput,
	createMessageInput,
	createCommandInput,
	type MessageInput,
	type CommandInput,
} from "../../source/models/input.js";

describe("models/input", () => {
	describe("isMessageInput", () => {
		it("returns true for message input", () => {
			const input: MessageInput = {
				type: "message",
				text: "hello",
				segments: [{ text: "hello" }],
				files: [],
			};
			expect(isMessageInput(input)).toBe(true);
		});

		it("returns false for command input", () => {
			const input: CommandInput = {
				type: "command",
				text: "/help",
				segments: [],
				commandPath: ["help"],
			};
			expect(isMessageInput(input)).toBe(false);
		});
	});

	describe("isCommandInput", () => {
		it("returns true for command input", () => {
			const input: CommandInput = {
				type: "command",
				text: "/help",
				segments: [],
				commandPath: ["help"],
			};
			expect(isCommandInput(input)).toBe(true);
		});

		it("returns false for message input", () => {
			const input: MessageInput = {
				type: "message",
				text: "hello",
				segments: [{ text: "hello" }],
				files: [],
			};
			expect(isCommandInput(input)).toBe(false);
		});
	});

	describe("createMessageInput", () => {
		it("creates a message input with content", () => {
			const result = createMessageInput("hello world");
			expect(result).toEqual({
				type: "message",
				text: "hello world",
				segments: [{ text: "hello world" }],
				files: [],
			});
		});

		it("creates a message input with empty content", () => {
			const result = createMessageInput("");
			expect(result).toEqual({
				type: "message",
				text: "",
				segments: [],
				files: [],
			});
		});

		it("creates a message input with custom segments and files", () => {
			const segments = [{ text: "@file.ts", color: "#87ceeb" }];
			const files = [{ path: "file.ts", isDirectory: false }];
			const result = createMessageInput("@file.ts", segments, files);
			expect(result).toEqual({
				type: "message",
				text: "@file.ts",
				segments: [{ text: "@file.ts", color: "#87ceeb" }],
				files: [{ path: "file.ts", isDirectory: false }],
			});
		});
	});

	describe("createCommandInput", () => {
		it("creates a command input with single command", () => {
			const result = createCommandInput(["help"], "/help");
			expect(result).toEqual({
				type: "command",
				text: "/help",
				segments: [],
				commandPath: ["help"],
			});
		});

		it("creates a command input with nested command", () => {
			const result = createCommandInput(
				["model", "openai", "gpt-4"],
				"/model openai gpt-4",
			);
			expect(result).toEqual({
				type: "command",
				text: "/model openai gpt-4",
				segments: [],
				commandPath: ["model", "openai", "gpt-4"],
			});
		});

		it("creates a command input with custom segments", () => {
			const segments = [
				{ text: "/", color: "#ffd700" },
				{ text: "help", color: "#ffd700" },
			];
			const result = createCommandInput(["help"], "/help", segments);
			expect(result).toEqual({
				type: "command",
				text: "/help",
				segments: segments,
				commandPath: ["help"],
			});
		});
	});
});
