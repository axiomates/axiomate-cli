import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render } from "ink-testing-library";
import StatusBar from "../../source/components/StatusBar.js";

// Mock useTranslation
vi.mock("../../source/hooks/useTranslation.js", () => ({
	useTranslation: () => ({
		t: (key: string) => {
			const translations: Record<string, string> = {
				"app.headerHintType": "Type",
				"app.headerHintForCommands": "for commands",
				"app.headerHintForShortcuts": "for shortcuts",
				"app.browseMode": "Browse",
				"app.inputMode": "Input",
				"app.modeSwitchHint": "Shift+Up/Down",
			};
			return translations[key] || key;
		},
	}),
}));

describe("StatusBar", () => {
	it("should render app name", () => {
		const { lastFrame } = render(<StatusBar />);
		expect(lastFrame()).toContain("axiomate");
	});

	it("should render hint text", () => {
		const { lastFrame } = render(<StatusBar />);
		expect(lastFrame()).toContain("Type");
		expect(lastFrame()).toContain("/");
		expect(lastFrame()).toContain("for commands");
		expect(lastFrame()).toContain("?");
		expect(lastFrame()).toContain("for shortcuts");
	});

	it("should show input mode by default", () => {
		const { lastFrame } = render(<StatusBar />);
		expect(lastFrame()).toContain("[Input]");
		expect(lastFrame()).toContain("Shift+Up/Down");
	});

	it("should show input mode when focusMode is input", () => {
		const { lastFrame } = render(<StatusBar focusMode="input" />);
		expect(lastFrame()).toContain("[Input]");
	});

	it("should show browse mode when focusMode is output", () => {
		const { lastFrame } = render(<StatusBar focusMode="output" />);
		expect(lastFrame()).toContain("[Browse]");
		expect(lastFrame()).toContain("Shift+Up/Down");
	});
});
