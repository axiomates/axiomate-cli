import { render } from "ink-testing-library";
import { describe, expect, it } from "vitest";
import App from "../source/app.js";

describe("App", () => {
	it("greets unknown user", () => {
		const { lastFrame } = render(<App name={undefined} />);
		expect(lastFrame()).toContain("Hello,");
		expect(lastFrame()).toContain("Stranger");
	});

	it("greets user with a name", () => {
		const { lastFrame } = render(<App name="Jane" />);
		expect(lastFrame()).toContain("Hello,");
		expect(lastFrame()).toContain("Jane");
	});
});
