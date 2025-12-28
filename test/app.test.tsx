import { render } from "ink-testing-library";
import { describe, expect, it } from "vitest";
import App from "../source/app.js";
import type { InitResult } from "../source/utils/init.js";

// Mock initResult for App component
// 测试环境没有配置文件，currentModel 为 null 是正常的
const mockInitResult: InitResult = {
	aiService: null,
	currentModel: null,
};

describe("App", () => {
	it("shows input mode indicator by default", () => {
		const { lastFrame } = render(<App initResult={mockInitResult} />);
		// Default mode is input mode
		expect(lastFrame()).toContain("[Input]");
	});

	it("shows mode switch hint in status bar", () => {
		const { lastFrame } = render(<App initResult={mockInitResult} />);
		// StatusBar shows mode switch hint
		expect(lastFrame()).toContain("Shift+↑↓");
	});
});
