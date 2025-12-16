import { render } from "ink-testing-library";
import { describe, expect, it } from "vitest";
import App from "../source/app.js";

describe("App", () => {
	it("renders the header with app title", () => {
		const { lastFrame } = render(<App />);
		expect(lastFrame()).toContain("axiomate-cli");
	});

	it("renders the input prompt", () => {
		const { lastFrame } = render(<App />);
		expect(lastFrame()).toContain(">");
	});

	it("renders divider lines", () => {
		const { lastFrame } = render(<App />);
		// Header and input area are separated by dividers
		expect(lastFrame()).toContain("─");
	});
});
